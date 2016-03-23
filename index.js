/**
 * koa isomorphic-render-method for react.
 * Created by Archer on 2016/03/23
 *
 * Usage:
 * var app = koa();
 * var reactIsoRender = require('koa-iso-render');
 * var Router = require('react-router');
 *
 * app.context.reactIsoRender = reactIsoRender({
 *   clientRouteFile: '../routes.jsx',
 *   proxyRender: 'render',
 *   reactRouter: Router
 * });
 *
 * app.use('/user', function* () {
 *   yield this.reactIsoRender('index.html', {
 *     'name': 'Archer',
 *     'blog': 'http://xiaoa.name'
 *   });
 * });
 *
 */

'use strict';
var assign = require('object-assign')
  , Promise = require('bluebird')
  , React = require('react')
  , renderToString = React.renderToString
  , createFactory = React.createFactory
  , debug = require('debug')('koa-iso-render');


function reactIsoRender(opts) {
  // babel hook register status
  var registered = false;

  // default options
  var defaultOptions = {
    proxyRender: 'render',
    notFoundTip: 'Not found.',
    errorTip: 'koa-iso-render error.',
    transform: true,
    viewType: 'jsx'
    babel: {
      presets: [
        'react',
        'es2015'
      ]
    }
  };

  // options
  var options = assign(opts || {}, defaultOptions);

  // react-router
  var Router = options.reactRouter
    , match = Router.match
    , RouterContext = Router.RouterContext

  // global babel hook
  if(options.transform && (!registered)) {
    require('babel-register')(
      assign({only: options.viewType}, options.babel)
    );
  }

  // render
  function* render(file, props){
    function _wrapperPromiseResult(status, res) {
      return {
        status: status,
        res: res
      }
    }

    // get component
    var _getComponent = function(routes, pathname) {
      new Promise(function(resolve, reject) {
        match({routes, location: { pathname: pathname }}, (err, rl, rp) => {
          if(err) {
            reject(_wrapperPromiseResult(500, err));
          } else if(rl) {
            resolve(_wrapperPromiseResult(302, rl));
          } else if(rp){
            resolve(_wrapperPromiseResult(200, rp));
          } else {
            resolve(_wrapperPromiseResult(404, null));
          }
        });
      });
    }

    var routes = require(options.clientRouteFile);

    // get component
    var com = yield _getComponent(routes, this.url)
      , realRender = this[options.proxyRender];

    // handle
    switch (com.status) {
      case 500:
        this.status = 500;
        this.throw(options.errorTip, 500);
        debug('koa-iso-render error: %s', com.res.stack);
        break;
      case 404:
        this.status = 404;
        this.throw(options.notFoundTip, 404);
        break;
      case 302:
        this.redirect(com.res.pathname + com.res.search);
        break;
      case 200:
        yield realRender(file, {
          html: renderToString(createFactory(com.routes[1].component)(props)),
          initialState: props
        })
        break;
      default:
        // pass
    }
  }

  // return
  return render;
}

module.exports = reactIsoRender;
