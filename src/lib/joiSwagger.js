import _ from 'lodash';
import joi from 'joi';

const extendedMethods = {
  swagger(params) {
    return params;
  },
  description(params) {
    return params;
  }
};

function createJoi(joi, bases, currentBase) {
  if (!bases) bases = _.keys(joi);
  if (!currentBase) [currentBase] = bases;
  function next(newJoi) {
    const nextBaseIndex = _.indexOf(bases, currentBase) + 1;
    if (nextBaseIndex < bases.length) {
      return createJoi(newJoi || joi, bases, bases[nextBaseIndex]);
    }
    return newJoi || joi;
  }
  let newJoi = null;
  try {
    if (_.isFunction(joi[currentBase])) {
      const base = joi[currentBase]();
      if (_.isObject(base) && base.isJoi) {
        newJoi = joi.extend(joi => ({
          base,
          name: currentBase,
          rules: _.map(extendedMethods, (extendedMethod, key) => ({
            name: key,
            params: {
              default: joi.any()
            },
            setup(params) {
              extendedMethod(params);
            },
            validate(_params, value, _state, _options) {
              return value;
            }
          }))
        }));
      }
    }
    return next(newJoi);
  } catch (err) {
    if (err.code === 'ERR_ASSERTION') {
      return next(newJoi);
    }
    throw err;
  }
}

export default createJoi(joi);
