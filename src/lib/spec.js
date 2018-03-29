import _ from 'lodash';

export default class Spec {
  constructor(schema, tag, key) {
    this.schema = schema;
    this.tag = tag;
    this.key = key;
    this.required = this.isRequired();
    this.type = this.getType();
    this.children = this.getChildren();
    this.swagger = this.getSwagger(this.children);
    this.valids = this.getValids();
    this.description = this.getDescription();
    this.examples = this.getExamples(this.valids, this.children);
  }

  getDescription() {
    return (
      this.getMethodValue(this.schema, 'description') ||
      _.upperFirst(
        _.snakeCase(`${this.tag} ${this.key || ''}`).replace(/_/g, ' ')
      )
    );
  }

  getSwagger(children) {
    const swagger = {
      type: this.type,
      required: this.required,
      description: this.description
    };
    if (this.type === 'object') {
      const properties = {};
      _.each(children, child => {
        properties[child.key] = child.swagger;
      });
      swagger.properties = properties;
    }
    return swagger;
  }

  getChildren() {
    const innerChildren = _.get(this.schema, '_inner.children', []);
    if (this.type === 'object') {
      const children = {};
      _.each(innerChildren, child => {
        children[child.key] = new Spec(child.schema, this.tag, child.key);
      });
      return children;
    }
    return _.map(innerChildren, child => {
      return new Spec(child.schema, this.tag, child.key);
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
