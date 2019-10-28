/**
 * 动态修改dva.js
 * 来同步iframe和top之间的store
 */
const fs = require('fs');
const path = require('path');
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from '@babel/generator';

let code = `
class _DvaContainer {
  componentDidMount() {
    const app = getApp();
    if(self !== top) {
      app._store.subscribe(() => {
        let currentStore = app._store.getState();
        console.log('store change', app._store.getState());
        window.parent.g_app._models.forEach(model => {
          model.state = currentStore[model.namespace];
        })
      })
    }
  }
  render() {
    const app = getApp();
    app.router(() => this.props.children);
    // 同步store
    if(self !== top) {
      let parentStore = window.parent.g_app._store.getState();
      app._models.forEach(model => {
        model.state = parentStore[model.namespace]
      })
    }
    console.log(app)
    return app.start()();
  }
}
`;

export default function (api, options) {

  api.onBuildSuccess(({ stats }) => {
    // handle with stats
    console.log('after build success')
    let projectDir = api.service.cwd;
    const envPath = process.env.NODE_ENV === 'prod' ? '.umi-production' : '.umi';
    const dvaFilePath = path.join(projectDir, `src/pages/${envPath}/dva.js`);
    let dvaCode = fs.readFileSync(dvaFilePath, 'utf-8');
    let ast = parser.parse(dvaCode, {
      // parse in strict mode and allow module declarations
      sourceType: "module",
    
      plugins: [
        // enable jsx and flow syntax
        "jsx",
        "flow",
        'react',
      ]
    });
    traverse(ast, {
      ExportNamedDeclaration: function(nodePath) {
        if(nodePath.node.declaration.id.name === '_DvaContainer') {
          const _ast = parser.parse(code);
          nodePath.node.declaration.body = _ast.program.body[0].body;
          fs.writeFileSync(dvaFilePath, generate(ast).code);
          console.log('rebuild dva.js');
        }
      }
    })
  });
}
