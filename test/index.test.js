import * as babel from 'babel-core';
import {resolve} from 'path';
import babelPluginReactComponentDataAttribute from '../src';

describe('babelPluginReactComponentDataAttribute()', () => {
  it('handles simple returns', () => {
    expect(transform(`
      function MyComponent() {
        return <div />;
      }
    `)).toMatchSnapshot();
  });

  it('does not add attributes to composite components', () => {
    expect(transform(`
      function MyComponent() {
        return <SomeOtherComponent />;
      }
    `)).toMatchSnapshot();
  });

  it('adds the attribute to the first non-composite component', () => {
    expect(transform(`
      function MyComponent() {
        return <SomeOtherComponent><div><div /></div></SomeOtherComponent>;
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {
        return (
          <SomeOtherComponent>{() => <div><div /></div>}</SomeOtherComponent>
        );
      }
    `)).toMatchSnapshot();
  });

  it('does not add attributes to JSX elements in props', () => {
    expect(transform(`
      function MyComponent() {
        return <SomeOtherComponent someProp={<div />}><div /></SomeOtherComponent>;
      }
    `)).toMatchSnapshot();
  });

  it('handles conditional returns', () => {
    expect(transform(`
      function MyComponent() {
        return true
          ? <div />
          : <span />;
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {
        if (true) {
          return <div />;
        } else {
          return <span />;
        }
      }
    `)).toMatchSnapshot();
  });

  it('only adds the attribute to the top-level node', () => {
    expect(transform(`
      function MyComponent() {
        return (
          <div><div /></div>
        );
      }
    `)).toMatchSnapshot();
  });

  it('does not add attributes from a parent function', () => {
    expect(transform(`
      function MyComponent() {
        return () => <div />;
      }
    `)).toMatchSnapshot();
  });

  it('adds the property to React.createElement calls', () => {
    expect(transform(`
      function MyComponent() {
        return React.createElement(someElement, {foo: 'bar'});
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {
        return React.createElement(someElement);
      }
    `)).toMatchSnapshot();
  });

  it('updates intermediate assignments as appropriate', () => {
    expect(transform(`
      function MyComponent() {
        const markup = <div />;
        return markup;
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {
        const markup = <SomeOtherComponent />;
        return markup;
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {
        const markup = null;
        return markup;
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {
        const markup = React.createElement('div', {});
        return markup;
      }
    `)).toMatchSnapshot();
  });

  it('only processes top-level components', () => {
    expect(transform(`
      if (true) {
        function MyComponent() {
          return <div />;
        }
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {}

      MyComponent.prototype.render = function render() {
        return <div />;
      }
    `)).toMatchSnapshot();
  });

  it('does not process nodes that already have the data attribute', () => {
    expect(transform(`
      function MyComponent() {
        return <div data-component="MyComponent" />;
      }
    `)).toMatchSnapshot();

    expect(transform(`
      function MyComponent() {
        return React.createElement('div', {'data-component': 'MyComponent'});
      }
    `)).toMatchSnapshot();
  });

  describe('name', () => {
    it('uses the variable name when no name exists', () => {
      expect(transform(`
        const MyComponent = class extends React.Component {
          render() {
            return <div />;
          }
        }
      `)).toMatchSnapshot();

      expect(transform(`
        const MyComponent = function() {
          return <div />;
        }
      `)).toMatchSnapshot();
    });

    it('uses the file’s basename when it is not unknown and is not an index file', () => {
      const filename = resolve('MyComponent.js');

      expect(transform(`
        export default class extends React.Component {
          render() {
            return <div />;
          }
        }
      `, {}, {filename})).toMatchSnapshot();

      expect(transform(`
        export default function() {
          return <div />;
        }
      `, {}, {filename})).toMatchSnapshot();

      expect(transform(`
        export default () => {
          return <div />;
        }
      `, {}, {filename})).toMatchSnapshot();
    });

    it('uses the file’s directory name when it is an index file', () => {
      const filename = resolve('MyComponent/index.js');

      expect(transform(`
        export default class extends React.Component {
          render() {
            return <div />;
          }
        }
      `, {}, {filename})).toMatchSnapshot();

      expect(transform(`
        export default function() {
          return <div />;
        }
      `, {}, {filename})).toMatchSnapshot();

      expect(transform(`
        export default () => {
          return <div />;
        }
      `, {}, {filename})).toMatchSnapshot();
    });
  });

  describe('arrow expressions', () => {
    it('handles non-block statement arrow expressions', () => {
      expect(transform(`
        const MyComponent = () => <div />;
      `)).toMatchSnapshot();
    });
  });

  describe('classes', () => {
    it('only adds attributes to render methods', () => {
      expect(transform(`
        class MyComponent extends React.Component {
          renderAnotherThing() {
            return <div />;
          }
        }
      `)).toMatchSnapshot();
    });
  });

  describe('options', () => {
    describe('onlyRootComponents', () => {
      it('adds attributes to components that are "root" ones', () => {
        expect(transform(`
          export default function MyComponent() {
            return <div />;
          }
        `, {onlyRootComponents: true}, {filename: resolve('MyComponent/index.js')})).toMatchSnapshot();

        expect(transform(`
          export default function SomeComponent() {
            return <div />;
          }
        `, {}, {filename: resolve('MyComponent/MyComponent.js')})).toMatchSnapshot();

        expect(transform(`
          export function MyComponent() {
            return <div />;
          }
        `, {onlyRootComponents: true}, {filename: resolve('MyComponent/MyComponent.js')})).toMatchSnapshot();

        expect(transform(`
          function MyComponent() {
            return <div />;
          }

          export default MyComponent;
        `, {onlyRootComponents: true}, {filename: resolve('MyComponent/MyComponent.js')})).toMatchSnapshot();

        expect(transform(`
          function MyComponent() {
            return <div />;
          }

          export default doSomethingTo(MyComponent);
        `, {onlyRootComponents: true}, {filename: resolve('MyComponent/MyComponent.js')})).toMatchSnapshot();

        expect(transform(`
          function MyComponent() {
            return <div />;
          }

          export {MyComponent};
        `, {onlyRootComponents: true}, {filename: resolve('MyComponent/MyComponent.js')})).toMatchSnapshot();
      });

      it('does not add data attributes to other components', () => {
        expect(transform(`
          function SomeComponent() {
            return <div />;
          }
        `, {onlyRootComponents: true}, {filename: resolve('MyComponent/index.js')})).toMatchSnapshot();

        expect(transform(`
          export default function SomeComponent() {
            return <div />;
          }
        `, {onlyRootComponents: true}, {filename: resolve('MyComponent/SomethingElse.js')})).toMatchSnapshot();
      });
    });
  });
});

function transform(code, pluginOptions, transformOptions) {
  return babel.transform(code, {
    babelrc: false,
    plugins: [
      [babelPluginReactComponentDataAttribute, pluginOptions],
    ],
    parserOpts: {
      plugins: ['jsx'],
    },
    ...transformOptions,
  }).code.trim();
}
