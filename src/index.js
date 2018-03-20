import Trailpack from 'trailpack';
import api from './api';
import config from './config';
import joiSwagger from './joiSwagger';
import pkg from './pkg';
import _ from 'lodash';
import fs from 'fs-extra';

const is = {
  required(schema) {
    return _.get(schema, '_flags.presence') === 'required';
  }
};

export default class TrailpackJoiSwagger extends Trailpack {
  constructor(app) {
    super(app, {
      config,
      pkg,
      api
    });
  }

  async validate() {
    return this;
  }

  configure() {
    return this;
  }

  async initialize() {
    const c = this.app.config;
    const swagger = this.createSwagger();
    console.log('swagger', swagger);
    await fs.writeFile('./swags.json', JSON.stringify(swagger, null, 2));
  }

  getEndpoint(method, route) {
    const validate = _.get(route, 'config.validate');
    const response = _.get(route, 'config.response');
    const parameters = [];
    const responses = {};
    if (validate) {
      if (validate.payload) {
        _.each(_.get(validate.payload, '_inner.children', []), child => {
          parameters.push({
            name: child.key,
            in: 'body',
            required: is.required(child.schema),
            type: child.schema._type
          });
        });
      }
      if (validate.query) {
        _.each(_.get(validate.query, '_inner.children', []), child => {
          parameters.push({
            name: child.key,
            in: 'query',
            required: is.required(child.schema),
            type: child.schema._type
          });
        });
      }
      if (validate.headers) {
        _.each(_.get(validate.headers, '_inner.children', []), child => {
          parameters.push({
            name: child.key,
            in: 'headers',
            required: is.required(child.schema),
            type: child.schema._type
          });
        });
      }
    }
    if (response && response.schema) {
      const properties = {};
      _.each(_.get(response.schema, '_inner.children', []), child => {
        properties[child.key] = { type: child.schema._type };
        responses['200'] = {
          schema: {
            type: 'object',
            properties
          }
        };
      });
    }
    return {
      description: _.get(
        route,
        'config.description',
        _.upperFirst(
          _.snakeCase(`${method} ${route.handler}`).replace(/_/g, ' ')
        )
      ),
      produces: ['application/json'],
      parameters: parameters.length ? parameters : undefined,
      responses: _.keys(responses).length ? responses : undefined
    };
  }

  getPaths() {
    const c = this.app.config;
    const paths = {};
    _.each(c.routes, route => {
      let path = {};
      if (_.isString(route.method)) {
        if (route.method === '*') {
          return true;
          path = {
            get: this.getEndpoint('get', route),
            post: this.getEndpoint('post', route),
            put: this.getEndpoint('put', route),
            update: this.getEndpoint('update', route),
            delete: this.getEndpoint('delete', route)
          };
        } else {
          const method = route.method.toLowerCase();
          path[method] = this.getEndpoint(method, route);
        }
      } else {
        _.each(route.method, method => {
          method = method.toLowerCase();
          path[method] = this.getEndpoint(method, route);
        });
      }
      paths[route.path] = path;
    });
    return paths;
  }

  createSwagger() {
    const {
      version = '',
      name = '',
      description = '',
      license = '',
      author = ''
    } = this.app.pkg;
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
      paths: this.getPaths()
    };
  }
}

export const joi = joiSwagger;
