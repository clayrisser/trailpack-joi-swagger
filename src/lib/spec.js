import _ from 'lodash';

export default class Spec {
  constructor(schema, { tag, key, parameterType, produces }) {
    this.schema = schema;
    this.tag = tag;
    this.key = key;
    this.produces = produces;
    this.parameterType = parameterType;
    this.required = this.isRequired();
    this.type = this.getType();
    this.valids = this.getValids();
    this.description = this.getDescription({
      schema: this.schema,
      tag: this.tag,
      key: this.key
    });
    this.children = this.getChildren();
    this.examples = this.getExamples(this.valids, this.children);
    this.swaggerSchema = this.getSwaggerSchema({
      produces: this.produces,
      examples: this.examples,
      children: this.children,
      required: this.required,
      type: this.type,
      description: this.description,
      key: this.key,
      parameterType: this.parameterType
    });
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

  getChildren() {
    const innerChildren = _.get(this.schema, '_inner.children', []);
    if (this.type === 'object') {
      const children = {};
      _.each(innerChildren, child => {
        children[child.key] = new Spec(child.schema, {
          tag: this.tag,
          key: child.key
        });
      });
      return children;
    }
    return _.map(innerChildren, child => {
      return new Spec(child.schema, { tag: this.tag, key: child.key });
    });
  }

  getExamples(valids, children) {
    if (this.type === 'object') {
      const example = {};
      _.each(children, (child, key) => {
        example[key] = _.get(child.examples, '0');
      });
      return [example];
    } else if (this.type === 'array') {
      return [
        _.map(children, child => {
          return _.get(child.examples, '0');
        })
      ];
    }
    const examples = _.without(
      _.uniq(_.concat([this.getMethodValue('example')], valids)),
      null,
      undefined,
      ''
    );
    if (!examples.length) return [`some-${this.type}`];
    return examples;
  }

  getMethodValue(testName, param = 'default') {
    return _.get(
      _.find(this.schema._tests, test => test.name === testName),
      `arg.${param}`
    );
  }

  isRequired() {
    return _.get(this.schema, '_flags.presence') === 'required';
  }

  getType() {
    return _.get(this.schema, '_type', 'object');
  }

  getValids() {
    return _.get(this.schema, '_valids._set', []);
  }
}
