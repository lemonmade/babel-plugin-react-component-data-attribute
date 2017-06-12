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

  function fileDetails({opts: {filename}}) {
    if (filename === 'unknown' || filename == null) { return null; }
    return {
      directory: basename(dirname(filename)),
      name: basename(filename, extname(filename)),
    };
  }

  function isExported(path, name) {
    if (
      path.parentPath.isExportDefaultDeclaration() ||
      path.parentPath.isExportNamedDeclaration()
    ) { return true; }

    const binding = path.scope.getBinding(name);

    return binding
      ? binding.referencePaths.some((referencePath) => (
        referencePath.getAncestry().some((ancestorPath) => (
          ancestorPath.isExportDefaultDeclaration() ||
          ancestorPath.isExportSpecifier() ||
          ancestorPath.isExportNamedDeclaration()
        ))
      ))
      : false;
  }

  function evaluatePotentialComponent(path, state) {
    const name = nameForReactComponent(path, state.file);
    return {
      name: name || '',
      process: name != null && shouldProcessPotentialComponent(path, name, state),
    };
  }

  function shouldProcessPotentialComponent(path, name, state) {
    if (!path.getFunctionParent().isProgram()) { return false; }
    if (path.parentPath.isAssignmentExpression()) { return false; }

    const {onlyRootComponents = false} = state.opts || {};
    if (!onlyRootComponents) { return true; }

    const details = fileDetails(state.file);
    if (details == null) { return false; }
    if (details.name !== 'index' && details.name !== details.directory) { return false; }

    return isExported(path, name);
  }

  function nameForReactComponent(path, file) {
    const {parentPath, node: {id}} = path;

    if (t.isIdentifier(id)) {
      return id.name;
    }

    if (parentPath.isVariableDeclarator()) {
      return parentPath.node.id.name;
    }

    const details = fileDetails(file);
    if (details == null) { return details; }

    return details.name === 'index'
      ? details.directory
      : details.name;
  }

  const returnStatementVisitor = {
    JSXElement(path, {name, source}) {
      // Bail early if we are in a different function than the component
      if (path.getFunctionParent() !== source) { return; }

      const openingElement = path.get('openingElement');
      const {node} = openingElement;
      if (!t.isJSXIdentifier(node.name) || !BUILTIN_COMPONENT_REGEX.test(node.name.name)) { return; }

      // We never want to go into a tree of JSX elements, only ever process the top-level item
      path.skip();

      // If we are in a regular prop (not children, bail out)
      if (path.parentPath.isJSXExpressionContainer()) { return; }

      const hasDataAttribute = node.attributes.some((attribute) => (
        t.isJSXIdentifier(attribute.name, {name: DATA_ATTRIBUTE})
      ));
      if (hasDataAttribute) { return; }

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

      const hasDataAttribute = secondArgument.node.properties.some((property) => (
        t.isStringLiteral(property.key, {value: DATA_ATTRIBUTE})
      ));
      if (hasDataAttribute) { return; }

      secondArgument.node.properties.push(createObjectProperty(name));
    },
  };

  const functionVisitor = {
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

  const programVisitor = {
    'ClassDeclaration|ClassExpression': (path, state) => {
      const {name, process} = evaluatePotentialComponent(path, state);
      if (!process) { return; }

      path
        .get('body.body')
        .filter((bodyPath) => bodyPath.isClassMethod() && bodyPath.get('key').isIdentifier({name: 'render'}))
        .forEach((renderPath) => {
          renderPath.traverse(functionVisitor, {name, source: renderPath});
        });
    },
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression': (path, state) => {
      const {name, process} = evaluatePotentialComponent(path, state);
      if (!process) { return; }

      if (path.isArrowFunctionExpression() && !path.get('body').isBlockStatement()) {
        path.traverse(returnStatementVisitor, {name, source: path});
      } else {
        path.traverse(functionVisitor, {name, source: path});
      }
    },
  };

  return {
    name: 'babel-plugin-react-component-data-attribute',
    visitor: {
      Program(path, state) {
        path.traverse(programVisitor, state);
      },
    },
  };
}
