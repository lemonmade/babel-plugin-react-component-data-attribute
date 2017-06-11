import {extname, basename, dirname} from 'path';

const BUILTIN_COMPONENT_REGEX = /^[a-z]+$/;
const DATA_ATTRIBUTE = 'data-component';

export default function babelPluginReactComponentDataAttribute({types: t}) {
  function createAttribute(name) {
    return t.jSXAttribute(t.jSXIdentifier(DATA_ATTRIBUTE), t.stringLiteral(name));
  }

  function createObjectProperty(name) {
    return t.objectProperty(t.stringLiteral(DATA_ATTRIBUTE), t.stringLiteral(name));
  }

  function nameForReactComponent(path, file) {
    const {opts: {filename}} = file;
    const {parentPath, node: {id}} = path;

    if (t.isIdentifier(id)) {
      return id.name;
    }

    if (parentPath.isVariableDeclarator()) {
      return parentPath.node.id.name;
    }

    if (filename === 'unknown') { return null; }

    const componentFileName = basename(filename, extname(filename));
    return componentFileName === 'index'
      ? basename(dirname(filename))
      : componentFileName;
  }

  const returnStatementVisitor = {
    JSXElement(path, {name, source}) {
      // We never want to go into a tree of JSX elements, only ever process the top-level item
      path.skip();

      // Bail early if we are in a different function than the component
      if (path.getFunctionParent() !== source) { return; }

      const openingElement = path.get('openingElement');
      const {node} = openingElement;
      if (!t.isJSXIdentifier(node.name) || !BUILTIN_COMPONENT_REGEX.test(node.name.name)) { return; }

      node.attributes.push(createAttribute(name));
    },
    CallExpression(path, {name, source}) {
      // Bail early if we are in a different function than the component
      if (path.getFunctionParent() !== source) { return; }
      if (!path.get('callee').isMemberExpression()) { return; }
      if (!path.get('callee.object').isIdentifier({name: 'React'})) { return; }
      if (!path.get('callee.property').isIdentifier({name: 'createElement'})) { return; }

      const {arguments: args} = path.node;
      if (args.length === 1) {
        args.push(t.objectExpression([createObjectProperty(name)]));
        return;
      }

      const secondArgument = path.get('arguments.1');
      if (!secondArgument.isObjectExpression()) { return; }

      secondArgument.node.properties.push(createObjectProperty(name));
    },
  };

  const renderMethodVisitor = {
    ReturnStatement(path, {name, source}) {
      const arg = path.get('argument');

      if (arg.isIdentifier()) {
        const binding = path.scope.getBinding(arg.node.name);
        if (binding == null) { return; }
        binding.path.traverse(returnStatementVisitor, {name, source});
      } else {
        path.traverse(returnStatementVisitor, {name, source});
      }
    },
  };

  return {
    name: 'babel-plugin-react-component-data-attribute',
    visitor: {
      'ClassDeclaration|ClassExpression': (path, state) => {
        const name = nameForReactComponent(path, state.file);
        if (name == null) { return; }

        path
          .get('body.body')
          .filter((bodyPath) => bodyPath.isClassMethod() && bodyPath.get('key').isIdentifier({name: 'render'}))
          .forEach((renderPath) => {
            renderPath.traverse(renderMethodVisitor, {name, source: renderPath});
          });
      },
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression': (path, state) => {
        const name = nameForReactComponent(path, state.file);
        if (name == null) { return; }

        if (path.isArrowFunctionExpression() && !path.get('body').isBlockStatement()) {
          path.traverse(returnStatementVisitor, {name, source: path});
        } else {
          path.traverse(renderMethodVisitor, {name, source: path});
        }
      },
    },
  };
}
