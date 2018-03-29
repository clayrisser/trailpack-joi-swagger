import _ from 'lodash';
import Spec from './spec';

const tags = [];

const is = {
  required(schema) {
    return _.get(schema, '_flags.presence') === 'required';
  },
  object(schema) {
    return get.type(schema) === 'object';
  }
};
const get = {
  valids(schema) {
    return _.get(schema, '_valids._set', []);
  },
  keys(schema) {
    return _.get(schema, '_inner.children', []);
  },
  type(schema) {
    return _.get(schema, '_type', 'object');
  },
  description(key, schema, tag) {
    return (
      get.methodValue(schema, 'description') ||
      _.upperFirst(_.snakeCase(`${tag} ${key}`).replace(/_/g, ' '))
    );
  },
  example(schema) {
    return get.methodValue(schema, 'example') || _.get(get.valids(schema), '0');
  },
  methodValue(schema, testName, param = 'default') {
    return _.get(
      _.find(schema._tests, test => test.name === testName),
      `arg.${param}`
    );
  }
};

function getEndpoint(method, route) {
  const parameters = [];
  const responses = {};
  const tag = getTag(method, route);
  const headers = getParameters({
    method,
    route,
    tag,
    parameterType: 'headers'
  });
  if (!_.includes(_.map(tags, tag => tag.name), tag)) {
    tags.push({
      name: tag,
      description: `${_.upperFirst(tag)} endpoints`
    });
  }
  _.each(
    getParameters({ method, route, tag, parameterType: 'query' }),
    value => {
      parameters.push(value.swaggerSchema);
    }
  );
  _.each(
    getParameters({ method, route, tag, parameterType: 'body' }),
    value => {
      parameters.push(value.swaggerSchema);
    }
  );
  _.each(headers, value => {
    parameters.push(value.swaggerSchema);
  });
  _.each(getResponses(method, route, tag), (response, status) => {
    responses[status] = {
      schema: response.swaggerSchema
    };
  });
  return {
    tags: [tag],
    description: getDescription(method, route),
    produces: _.get(headers, 'content-type.valids', []),
    parameters: parameters.length ? parameters : undefined,
    responses: _.keys(responses).length ? responses : undefined
  };
}

function getDescription(method, route, tag) {
  if (!tag) tag = getTag(method, route);
  return _.get(
    route,
    'config.description',
    _.upperFirst(_.snakeCase(route.handler).replace(/_/g, ' '))
  );
}

function getParameters({ method, route, tag, parameterType }) {
  if (!tag) tag = getTag(method, route);
  const parameters = {};
  const schema = _.get(
    route,
    [
      'config',
      'validate',
      parameterType === 'body' ? 'payload' : parameterType
    ],
    {}
  );
  _.each(_.get(schema, '_inner.children', []), child => {
    parameters[child.key] = new Spec(child.schema, {
      key: child.key,
      tag,
      parameterType
    });
  });
  return parameters;
}

function getResponses(method, route, tag) {
  if (!tag) tag = getTag(method, route);
  const response = _.get(route, 'config.response', {});
  const responses = {};
  if (response.schema) {
    responses['200'] = new Spec(response.schema, { tag });
  }
  return responses;
}

function getTag(method, route) {
  const tag = _.get(
    route.path.match(/\/api\/v\d\/([^/]+)/),
    '1',
    (route.path.match(/[^/]+(?=\/[^/]+\/?$)/g) || []).join('')
  );
  if (!tag.length) return 'default';
  return tag;
}

function getPaths(app) {
  const c = app.config;
  const paths = {};
  _.each(c.routes, route => {
    const path = {};
    if (_.isString(route.method)) {
      if (route.method === '*') {
        return true;
      }
      const method = route.method.toLowerCase();
      path[method] = getEndpoint(method, route);
    } else {
      _.each(route.method, method => {
        method = method.toLowerCase();
        path[method] = getEndpoint(method, route);
      });
    }
    paths[route.path] = { ...paths[route.path], ...path };
    return true;
  });
  return paths;
}

export default function createSwagger(app) {
  const {
    version = '',
    name = '',
    description = '',
    license = '',
    author = ''
  } = app.pkg;
  const paths = getPaths(app);
  return {
    swagger: '2.0',
    info: {
      version,
      title: name,
      description,
      termsOfService: 'http://swagger.io/terms/',
      contact: {
        name: _.isString(author) ? author : author.name || ''
      },
      license: {
        name: license
      }
    },
    host: 'petstore.swagger.io',
    basePath: '/',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    paths,
    tags
  };
}
