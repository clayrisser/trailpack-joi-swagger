import Trailpack from 'trailpack';
import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import api from './api';
import config from './config';
import joiSwagger from './lib/joiSwagger';
import createSwagger from './lib/createSwagger';
import pkg from './pkg';

const { argv } = process;

export default class TrailpackJoiSwagger extends Trailpack {
  constructor(app) {
    super(app, {
      config,
      pkg,
      api
    });
  }

  tags = [];

  async validate() {
    return this;
  }

  configure() {
    return this;
  }

  async initialize() {
    if (_.includes(argv, '--swagger')) {
      const swaggerPath = path.resolve(
        _.get(argv, _.indexOf(argv, '--swagger') + 1, './swagger.json')
      );
      const swagger = createSwagger(this.app);
      await fs.writeFile(swaggerPath, JSON.stringify(swagger, null, 2));
      this.log.info(`Swagger docs saved to ${path.resolve(swaggerPath)}`);
      process.exit(0);
    }
  }
}

export const joi = joiSwagger;
