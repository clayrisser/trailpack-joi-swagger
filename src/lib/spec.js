import _ from 'lodash';

export default class Spec {
  constructor(schema, { tag, key, parameterType, produces }) {
    const required = this.isRequired(schema);
    const type = this.getType(schema);
    const valids = this.getValids(schema);
    const description = this.getDescription({
      key,
      schema,
      tag
    });
    const children = this.getChildren({
      schema,
      tag,
      type
    });
    const examples = this.getExamples({ valids, children, type, schema });
    const swaggerSchema = this.getSwaggerSchema({
      children,
      description,
      examples,
      key,
      parameterType,
      produces,
      required,
      type
    });
    this.children = children;
    this.description = description;
    this.examples = examples;
    this.key = key;
    this.parameterType = parameterType;
    this.produces = produces;
    this.required = required;
    this.schema = schema;
    this.swaggerSchema = swaggerSchema;
    this.tag = tag;
    this.type = type;
    this.valids = valids;
  }

  getDescription({ schema, tag, key }) {
    return (
      this.getMethodValue(schema, 'description') ||
      _.upperFirst(_.snakeCase(`${tag} ${key || ''}`).replace(/_/g, ' '))
    );
  }

  getSwaggerSchema({
    children,
    examples,
    required,
    type,
    description,
    produces,
    key,
    parameterType
  }) {
    const swaggerSchema = {
      type,
      description,
      required
    };
    if (parameterType) {
      if (parameterType === 'response') {
        swaggerSchema.examples = {};
        _.each(produces, produced => {
          swaggerSchema.examples[produced] = _.get(examples, '0');
        });
      } else {
        if (key) swaggerSchema.name = key;
        swaggerSchema.in = parameterType;
      }
    }
    if (type === 'object') {
      const properties = {};
      _.each(children, child => {
        properties[child.key] = child.swaggerSchema;
      });
      swaggerSchema.properties = properties;
    }
    return swaggerSchema;
  }

  getChildren({ tag, type, schema }) {
    const innerChildren = _.get(schema, '_inner.children', []);
    if (type === 'object') {
      const children = {};
      _.each(innerChildren, child => {
        children[child.key] = new Spec(child.schema, {
          tag,
          key: child.key
        });
      });
      return children;
    }
    return _.map(innerChildren, child => {
      return new Spec(child.schema, { tag, key: child.key });
    });
  }

  getExamples({ valids, children, type, schema }) {
    if (type === 'object') {
      const example = {};
      _.each(children, (child, key) => {
        example[key] = _.get(child.examples, '0');
      });
      return [example];
    } else if (type === 'array') {
      return [
        _.map(children, child => {
          return _.get(child.examples, '0');
        })
      ];
    }
    const examples = _.without(
      _.uniq(_.concat([this.getMethodValue(schema, 'example')], valids)),
      null,
      undefined,
      ''
    );
    if (!examples.length) return [`some-${type}`];
    return examples;
  }

  getMethodValue(schema, testName, param = 'default') {
    return _.get(
      _.find(schema._tests, test => test.name === testName),
      `arg.${param}`
    );
  }

  isRequired(schema) {
    return _.get(schema, '_flags.presence') === 'required';
  }

  getType(schema) {
    return _.get(schema, '_type', 'object');
  }

  getValids(schema) {
    return _.get(schema, '_valids._set', []);
  }
}
