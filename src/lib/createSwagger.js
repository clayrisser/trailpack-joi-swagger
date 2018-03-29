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
  const headers = getHeaders(method, route, tag);
  if (!_.includes(_.map(tags, tag => tag.name), tag)) {
    tags.push({
      name: tag,
      description: `${_.upperFirst(tag)} endpoints`
    });
  }
  _.each(getQuery(method, route, tag), (value, key) => {
    parameters.push({
      description: value.description,
      in: 'query',
      name: key,
      required: value.required,
      type: value.type
    });
  });
  _.each(getBody(method, route, tag), (value, key) => {
    parameters.push({
      description: value.description,
      in: 'body',
      name: key,
      required: value.required,
      type: value.type
    });
  });
  _.each(headers, (header, key) => {
    parameters.push({
      description: header.description,
      in: 'headers',
      name: key,
      required: header.required,
      type: header.type,
      example: header.example
    });
  });
  _.each(getResponses(method, route, tag), (response, status) => {
    responses[status] = {
      schema: {
        type: 'object',
        properties: {}
      }
    };
    _.each(response, (value, key) => {
      responses[status].schema.properties[key] = {
        description: value.description,
        required: value.required,
        type: value.type
      };
    });
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

function getHeaders(method, route, tag) {
  if (!tag) tag = getTag(method, route);
  const headers = {};
  const validate = _.get(route, 'config.validate', {});
  _.each(get.keys(validate.headers), child => {
    const valids = get.valids(child.schema);
    headers[child.key] = {
      description: get.description(child.key, child.schema, tag),
      example: get.example(child.schema),
      required: is.required(child.schema),
      schema: child.schema,
      type: get.type(child.schema),
      valids
    };
  });
  return headers;
}

function getBody(method, route, tag) {
  if (!tag) tag = getTag(method, route);
  const body = {};
  const validate = _.get(route, 'config.validate', {});
  _.each(get.keys(validate.payload), child => {
    const valids = get.valids(child.schema);
    body[child.key] = {
      description: get.description(child.key, child.schema, tag),
      example: get.example(child.schema),
      required: is.required(child.schema),
      schema: child.schema,
      type: get.type(child.schema),
      valids
    };
  });
  return body;
}

function getQuery(method, route, tag) {
  if (!tag) tag = getTag(method, route);
  const query = {};
  const validate = _.get(route, 'config.validate', {});
  _.each(get.keys(validate.query), child => {
    const valids = get.valids(child.schema);
    query[child.key] = {
      description: get.description(child.key, child.schema, tag),
      example: get.example(child.schema),
      required: is.required(child.schema),
      schema: child.schema,
      type: get.type(child.schema),
      valids
    };
  });
  return query;
}

function getResponses(method, route, tag) {
  if (!tag) tag = getTag(method, route);
  const responses = {
    '200': {}
  };
  const response = _.get(route, 'config.response', {});
  if (response.schema) {
    const spec = new Spec(response.schema);
    console.log('spec.type', spec.type);
    console.log('spec.required', spec.required);
    console.log('spec.examples', spec.examples);
    console.log('spec.children', _.keys(spec.children));
  }
  _.each(get.keys(response.schema), child => {
    const valids = get.valids(child.schema);
    responses['200'][child.key] = {
      description: get.description(child.key, child.schema, tag),
      example: get.example(child.schema),
      required: is.required(child.schema),
      schema: child.schema,
      type: get.type(child.schema),
      valids
    };
  });
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
