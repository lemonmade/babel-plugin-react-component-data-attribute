# babel-plugin-react-component-data-attribute

This plugin adds a `data-component` attribute to top-level DOM elements rendered by your component. This can be useful for constructing a high-level component hierarchy outside the context of your React application (for instance, for the purposes of click tracking).

## Example

**In**

```js
class ComponentOne extends React.Component {
  render() {
    return <div />;
  }
}

function ComponentTwo() {
  return someCondition
    ? <div><div /></div>
    : <ComponentOne />;
}

const ComponentThree = () => (
  <div />
);
```

**Out**

```js
class ComponentOne extends React.Component {
  render() {
    return <div data-component="ComponentOne" />;
  }
}

function ComponentTwo() {
  return someCondition
    ? <div data-component="ComponentTwo"><div /></div>
    : <ComponentOne />;
}

const ComponentThree = () => (
  <div data-component="ComponentThree" />
);
```

## Installation

```sh
# yarn
yarn add --dev babel-plugin-react-component-data-attribute

# npm
npm install --save-dev babel-plugin-react-component-data-attribute
```

## Usage

### Via `.babelrc` (Recommended)

**.babelrc**

```json
{
  "plugins": ["react-component-data-attribute"]
}
```

### Via CLI

```sh
babel --plugins react-component-data-attribute script.js
```

### Via Node API

```js
require('babel-core').transform('code', {
  plugins: ['react-component-data-attribute'],
});
```

## Options

This plugin accepts an options object with a single option: `onlyRootComponents`. When this option is `true`, only components that appear to be the "main" part of a particular component will get the data attribute. The plugin determines whether a component is "root" or not based on the following criteria:

* It is a named or default export
* It is in a file named `index`, or in a file named the same as the directory (so, for instance, `MyComponent/MyComponent.js`)

