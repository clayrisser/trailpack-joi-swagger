import Trailpack from 'trailpack';
import api from './api';
import config from './config';
import joiSwagger from './joiSwagger';
import pkg from './pkg';
import Promise from 'bluebird';

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
    return this;
  }
}

export const joi = joiSwagger;
