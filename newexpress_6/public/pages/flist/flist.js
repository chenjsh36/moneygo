(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              if(console.trace){
                console.trace();
              }
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          if(console.trace){
            console.trace();
          }
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    function recursivelyGarbageCollect(root) {
      if (root === undefined) {
        return;
      }
      var keys = Object.keys(root);
      for (var i in keys) {
        var key = keys[i];
        var obj = root[key];
        if ((obj instanceof Function) || (typeof obj !== "object"))
          continue;
        if (Object.keys(obj).length > 0) {
          recursivelyGarbageCollect(root[key]);
        }
        if (Object.keys(obj).length === 0) {
          delete root[key];
        }
      }
    }
    recursivelyGarbageCollect(this.listenerTree);

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events || !this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  } else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
  module.exports.EventEmitter2 = EventEmitter;
}();

},{}],2:[function(require,module,exports){
var EVENTEMITTER;

EVENTEMITTER = require('./../../lib/eventemitter2/eventemitter2').EventEmitter2;

module.exports = new EVENTEMITTER;



},{"./../../lib/eventemitter2/eventemitter2":1}],3:[function(require,module,exports){
var CostChartShow, EventEmitter, FListTable, Flist, RangeChartShow, _cost, _flist, cost_options, data_center, eventbus, options,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

EventEmitter = require('../../lib/eventemitter2/eventemitter2').EventEmitter2;

eventbus = require('../../own_modules/eventbus/eventbus');

data_center = {};

Flist = (function(superClass) {
  extend(Flist, superClass);

  function Flist(options) {
    var callback_, context;
    context = this;
    this.defaults = {
      name: this.getVal(options.name, 'cjj'),
      container: this.getVal(options.container, $('body')),
      elem: null,
      f_list_table: new FListTable({
        container: this.getVal(options.container, $('body')),
        flist: context
      }),
      eventbus: this.getVal(options.eventbus, null)
    };
    this.datas = null;
    this.on('Flist:request', this.request);
    this.defaults.eventbus.on('Flist:request', this.request);
    this.on('FList:dataChange', this.dataChange);
    callback_ = function(data) {
      context.calData(data);
      return context.render();
    };
    eventbus.emit('Flist:request', callback_);
  }


  /**
  	 * 更新数据
   */

  Flist.prototype.dataChange = function(data) {
    var context, send_data;
    context = this;
    console.log('Flist: dataChange:', data);
    send_data = {
      edit: data
    };
    console.log('before send :', send_data);
    return $.ajax({
      type: 'POST',
      url: '/edit',
      data: send_data,
      success: function(data) {
        console.log(data);
        return context.defaults.f_list_table.emit('FListTable:dataChange', {});
      },
      error: function(data) {
        console.log(data);
        return context.defaults.f_list_table.emit('FListTable:dataChange', {});
      }
    });
  };


  /**
  	 * 处理数据
  	 * @param  {obj} data 未处理的函数
  	 * @return {bool}      是否含有数据
   */

  Flist.prototype.calData = function(data) {
    var err, flist, has_data;
    has_data = true;
    flist = [];
    err = '';
    if ((data['ret_code'] != null) && parseInt(data['ret_code']) === 200) {
      if ((data['data'] != null) && data['data'].length > 0) {
        $.each(data['data'], function(i, e) {
          return flist.push({
            id: e.id,
            belong_id: e.belong_id,
            date: e.date,
            number: e.number,
            type_id: e.type_id,
            tag_arr: e.tag_arr
          });
        });
      } else {
        console.log('data length less then 0');
        has_data = false;
      }
    } else {
      console.log('ret_code not 200');
      has_data = false;
      err = data['err'] != null ? data['err'] : 'http state not 200!';
    }
    this.datas = {
      has_data: has_data,
      flist: flist
    };
    data_center.flist = flist;
    return has_data;
  };


  /**
  	 * 返回obj的值，不存在则返回defaults
   */

  Flist.prototype.getVal = function(obj, defaults) {
    if (obj != null) {
      return obj;
    } else {
      return defaults;
    }
  };


  /**
  	 * 读取对象的datas并渲染对象
  	 * @return {obj} 当前对象
   */

  Flist.prototype.render = function() {
    if (this.datas.has_data) {
      return this.defaults.f_list_table.emit('FListTable:renderData', this.datas);
    } else {
      return console.log('暂无数据，请创建');
    }
  };


  /**
  	 * 请求财务信息列表
  	 * @param  {Function} callback 请求完成后调用的函数
  	 * @return {null}            none
   */

  Flist.prototype.request = function(callback) {
    return $.ajax({
      type: 'get',
      dataType: 'json',
      url: '/getList',
      success: function(data) {
        return callback(data);
      },
      error: function(data) {
        console.log('Error', data);
        return callback(data);
      }
    });
  };

  Flist.prototype.show = function() {
    return this.defaults.container.show();
  };

  Flist.prototype.hide = function() {
    return this.defaults.container.hide();
  };

  return Flist;

})(EventEmitter);

FListTable = (function(superClass) {
  extend(FListTable, superClass);

  function FListTable(options) {
    var context;
    context = this;
    this.defaults = {
      name: 'FListTable',
      container: this.getVal(options.container, $('body')),
      eventbus: this.getVal(options.eventbus, eventbus),
      table: null,
      datas: null,
      flist: this.getVal(options.flist, {})
    };
    this.on('FListTable:renderData', context.render);
    this.defaults.eventbus.on('FListTable:renderData', context.render);
    this.on('FListTable:dataChange', context.dataChange);
    this.init();
  }

  FListTable.prototype.dataChange = function(res) {
    console.log('FListTable:datachange res: ', res);
    $('#edit-flist').text('Edit');
    return $('#edit-flist').attr('value', 'Save');
  };

  FListTable.prototype.init = function() {
    var context, table, table_html;
    table_html = "<div class=\"ui inverted segment\">\n	<button class=\"ui inverted yellow button\" id=\"edit-flist\" value=\"Save\">Edit</button>\n	<button class=\"ui inverted red button\" id=\"add-flist\">New</button>\n	<div class=\"new-finance-form\">\n		<label for=\"time\">时间</label>\n		<div class=\"ui input\">\n			<input type=\"text\" id=\"new-finance-time\" date-time-format=\"YYYY-mm-dd\">\n		</div>\n		<label for=\"cost\">总额</label>\n		<div class=\"ui input\">\n			<input type=\"text\" id=\"new-finance-cost\" class=\"ui inverted input\">\n		</div>\n		<label for=\"time\">类型</label>\n		<div class=\"ui input\">\n			<input type=\"text\" id=\"new-finance-type\" class=\"ui inverted input\">\n		</div>\n		<button id=\"save-new-finance\" class=\"ui button\">保存</button>\n	</div>\n	<table class=\"ui selectable inverted table\">\n		<thead>\n			<tr>\n				<th>date</th>\n				<th>cost</th>\n				<th class=\"left aligned\">type</th>\n				<th class=\"operate-item-head display-none\">operate</th>\n			</tr>\n		</thead>\n		<tbody>\n		</tbody>\n	</table>\n</div>";
    table = $(table_html);
    this.defaults.container.append(table);
    this.defaults.table = table;
    context = this;
    table.find('#new-finance-time').datetimepicker({
      lang: 'ch',
      format: 'Y-m-d',
      timepicker: false,
      onChangeDateTime: function(params, input, event) {},
      onShow: function(params) {}
    });
    table.find('#save-new-finance').on('click', function(e) {
      var $form, cost, send_data, time, type;
      $form = $(this).closest('.new-finance-form');
      time = $form.find('#new-finance-time').val();
      cost = $form.find('#new-finance-cost').val();
      type = $form.find('#new-finance-type').val();
      console.log('show data:', time, cost, type);
      if (time === '' || cost === '' || type === '') {
        alert('请填写完整的消费记录！');
      }
      if (isNaN(cost)) {
        return alert('请填写合法的金额');
      } else {
        send_data = {
          date: time,
          number: cost,
          tag_arr: type,
          type_id: 0
        };
        return $.ajax({
          type: 'POST',
          url: '/add',
          data: send_data,
          success: function(data) {
            console.log('success:', data);
            if (data.ret_code === '200') {
              alert('添加成功');
            } else {
              alert('更新失败');
            }
            return location.reload();
          },
          error: function(data) {
            alert('添加失败');
            return location.reload();
          }
        });
      }
    });
    table.find('#edit-flist').on('click', function(e) {
      var $f_list, costInput, f_list_data, typeInput;
      console.log('edit-flist click!');
      if ($(this).attr('value') === 'Save') {
        $(this).text('Save');
        $(this).attr('value', 'Edit');
        $('.time-item').datetimepicker({
          lang: 'ch',
          format: 'YYYY-mm-dd',
          timepicker: false,
          onChangeDateTime: function(params, input, event) {
            var new_date;
            console.log(arguments, params.getUTCDate(), params.toDateString(), params.toLocaleDateString(), params.toLocaleString(), params.toUTCString());
            new_date = params.toLocaleDateString();
            new_date = new_date.split('/').join('-');
            return input.text(new_date);
          },
          onShow: function(params) {
            return console.log(arguments);
          }
        });
        costInput = function(e) {
          var input_html, old;
          if ($(this).find('input').length === 0) {
            old = $(this).text();
            $(this).attr('val', old);
            input_html = "<input class=\"ui inverted input\" type=\"text\" value=\"" + old + "\"/>";
            return $(this).html(input_html);
          }
        };
        $('.cost-item').on('click', costInput);
        typeInput = function(e) {
          var input_html, old;
          if ($(this).find('input').length === 0) {
            old = $(this).text();
            $(this).attr('val', old);
            input_html = "<input class=\"ui inverted input\" type=\"text\" value=\"" + old + "\"/>";
            return $(this).html(input_html);
          }
        };
        $('.type-item').on('click', typeInput);
        $('.operate-item-head').removeClass('display-none');
        return $('.operate-item').removeClass('display-none');
      } else {
        $('.time-item').datetimepicker('destroy');
        $.each($('.cost-item'), function(i, e) {
          var $input, new_val, reg;
          $input = $(this).find('input');
          if ($input.length !== 0) {
            new_val = $input.val();
            console.log($(this), $(this).attr('val'), new_val);
            reg = /^[a-zA-Z0-9\u4e00-\u9fa5 ]+$/;
            if (reg.test(new_val) === true) {
              console.log('true while test the reg:', new_val);
              return $(this).html(new_val);
            } else {
              console.log(new_val, ' is false while test the reg');
              return $(this).html($(this).attr('val'));
            }
          }
        });
        $.each($('.type-item'), function(i, e) {
          var $input, new_val;
          $input = $(this).find('input');
          if ($input.length !== 0) {
            new_val = $input.val();
            if (new_val !== '') {
              return $(this).html(new_val);
            } else {
              return $(this).html($(this).attr('val'));
            }
          }
        });
        console.log('defaults:', context.defaults);
        $f_list = context.defaults.container.find('tbody tr');
        f_list_data = [];
        $.each($f_list, function(i, e) {
          var cost, id, time, type;
          time = $f_list.eq(i).find('.time-item').text();
          cost = $f_list.eq(i).find('.cost-item').text();
          type = $f_list.eq(i).find('.type-item').text();
          id = $f_list.eq(i).attr('alt');
          return f_list_data.push({
            id: id,
            date: time,
            number: cost,
            tag_arr: type
          });
        });
        context.defaults.datas = f_list_data;
        context.defaults.flist.emit('FList:dataChange', context.defaults.datas);
        $('.cost-item').unbind('click');
        $('.type-item').unbind('click');
        $('.operate-item-head').addClass('display-none');
        return $('.operate-item').addClass('display-none');
      }
    });
    table.find('#add-flist').on('click', function(e) {
      console.log('to add new finance');
      return context.defaults.container.find('.new-finance-form').show();
    });
    return table.find('tbody').on('click', '.operate-item', function(e) {
      var finance_id, send_data, that;
      that = $(this).closest('tr');
      finance_id = that.attr('alt');
      send_data = {
        finance_id: finance_id
      };
      return $.ajax({
        type: 'POST',
        url: '/del',
        data: send_data,
        success: function(data) {
          if (data.ret_code === '200') {
            console.log('delete ok!');
            return that.remove();
          } else {
            return console.log('delete fail');
          }
        },
        error: function(data) {
          return console.log('delete fail');
        }
      });
    });
  };

  FListTable.prototype.getVal = function(obj, defaults) {
    if (obj != null) {
      return obj;
    } else {
      return defaults;
    }
  };

  FListTable.prototype.render = function(datas) {
    var context, items_html;
    context = this;
    this.defaults.datas = datas;
    console.log(datas);
    items_html = '';
    $.each(datas.flist, function(i, e) {
      var cost_, date_, id_, item_html, type_;
      date_ = e.date.slice(0, 10);
      cost_ = e.number;
      type_ = e.tag_arr.join(' ');
      id_ = e.id;
      item_html = "<tr alt=\"" + id_ + "\">\n	<td class=\"time-item\">" + date_ + "</td>\n	<td class=\"cost-item\">" + cost_ + "</td>\n	<td class=\"type-item\">" + type_ + "</td>\n	<td class=\"operate-item display-none\">delete</td>\n</tr>";
      return items_html += item_html;
    });
    return this.defaults.table.find('tbody').html(items_html);
  };

  return FListTable;

})(EventEmitter);

CostChartShow = (function(superClass) {
  extend(CostChartShow, superClass);

  function CostChartShow(options) {
    this.defaults = {
      container: this.getVal(options.container, $('body'))
    };
    this.init();
  }

  CostChartShow.prototype.init = function() {
    var chart_html;
    chart_html = "<div id=\"cost-chart-container\" class=\"chart_container\" style=\"width: 600px; height: 400px;\"></div>";
    this.defaults.container.hide();
    this.defaults.container.html(chart_html);
    if (data_center.flist !== null) {
      this.defaults.data = data_center.flist;
      return this.showCostChart();
    }
  };

  CostChartShow.prototype.showCostChart = function() {
    var cost_chart, data, date, f, flist_, j, len, option;
    if (data_center.flist === null || typeof data_center.flist === 'undefined') {

    } else {
      flist_ = data_center.flist;
      console.log('flist_:', flist_);
      date = [];
      data = [];
      for (j = 0, len = flist_.length; j < len; j++) {
        f = flist_[j];
        date.push(f.date.slice(0, 10));
        data.push(f.number);
      }
      cost_chart = echarts.init($('#cost-chart-container')[0]);
      console.log(date, data);
      option = {
        title: {
          x: 'center',
          text: '收入支出'
        },
        legend: {
          top: 'bottom',
          data: ['意向']
        },
        toolbox: {
          show: true,
          feature: {
            mark: {
              show: true
            },
            dataView: {
              show: true,
              readOnly: false
            },
            magicType: {
              show: true,
              type: ['line', 'bar', 'stack', 'tiled']
            },
            restore: {
              show: true
            },
            saveAsImage: {
              show: true
            }
          }
        },
        xAxis: [
          {
            type: 'category',
            boundaryGap: false,
            data: date
          }
        ],
        yAxis: [
          {
            type: 'value'
          }
        ],
        dataZoom: {
          type: 'inside',
          start: 60,
          end: 80
        },
        series: [
          {
            name: '成交',
            type: 'line',
            smooth: true,
            symbol: 'none',
            stack: 'a',
            areaStyle: {
              normal: {}
            },
            data: data
          }
        ]
      };
      return cost_chart.setOption(option);
    }
  };


  /**
  	 * 返回obj的值，不存在则返回defaults
   */

  CostChartShow.prototype.getVal = function(obj, defaults) {
    if (obj != null) {
      return obj;
    } else {
      return defaults;
    }
  };

  CostChartShow.prototype.show = function() {
    this.showCostChart();
    return this.defaults.container.show();
  };

  CostChartShow.prototype.hide = function() {
    return this.defaults.container.hide();
  };

  return CostChartShow;

})(EventEmitter);

RangeChartShow = (function(superClass) {
  extend(RangeChartShow, superClass);

  function RangeChartShow(options) {
    this.defaults = {
      container: this.getVal(options.container, $('body'))
    };
    this.init();
  }

  RangeChartShow.prototype.init = function() {
    if (data_center.flist !== null) {
      this.defaults.data = data_center.flist;
      return this.showRangeChart();
    }
  };

  RangeChartShow.prototype.update = function() {
    if (data_center.flist !== null) {
      this.defaults.data = data_center.flist;
      return this.showRangeChart();
    }
  };

  RangeChartShow.prototype.showRangeChart = function() {
    return console.log('to show showRangeChart');
  };


  /**
  	 * 返回obj的值，不存在则返回defaults
   */

  RangeChartShow.prototype.getVal = function(obj, defaults) {
    if (obj != null) {
      return obj;
    } else {
      return defaults;
    }
  };

  RangeChartShow.prototype.show = function() {
    this.update();
    return this.defaults.container.show();
  };

  RangeChartShow.prototype.hide = function() {
    return this.defaults.container.hide();
  };

  return RangeChartShow;

})(EventEmitter);

options = {
  name: 'cjs',
  container: $('.ui.grid.finance .olive.twelve.wide.column .finance-table'),
  eventbus: eventbus
};

_flist = new Flist(options);

cost_options = {
  container: $('.ui.grid.finance .olive.twelve.wide.column .cost-chart')
};

_cost = new CostChartShow(cost_options);

$('#finance-list').on('click', function(e) {
  console.log('to show finance-list');
  _flist.show();
  return _cost.hide();
});

$('#finance-cost').on('click', function(e) {
  console.log('to show cost area');
  _flist.hide();
  return _cost.show();
});

$('#finance-type').on('click', function(e) {
  console.log('to show type');
  _flist.hide();
  return _cost.hide();
});



},{"../../lib/eventemitter2/eventemitter2":1,"../../own_modules/eventbus/eventbus":2}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOi9jaGVuanNoMzYvbXlkZXZlbG9wL25vZGUvbmV3ZXhwcmVzc182L3dlYmZlL2xpYi9ldmVudGVtaXR0ZXIyL2V2ZW50ZW1pdHRlcjIuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXG93bl9tb2R1bGVzXFxldmVudGJ1c1xcZXZlbnRidXMuY29mZmVlIiwiRTpcXGNoZW5qc2gzNlxcbXlkZXZlbG9wXFxub2RlXFxuZXdleHByZXNzXzZcXHdlYmZlXFxwYWdlc1xcZmxpc3RcXGZsaXN0LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JsQkEsSUFBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLHlDQUFSLENBQWtELENBQUM7O0FBQ2xFLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLElBQUk7Ozs7O0FDRHJCLElBQUEsMkhBQUE7RUFBQTs7O0FBQUEsWUFBQSxHQUFlLE9BQUEsQ0FBUSx1Q0FBUixDQUFnRCxDQUFDOztBQUNoRSxRQUFBLEdBQVcsT0FBQSxDQUFRLHFDQUFSOztBQUlYLFdBQUEsR0FBYzs7QUFFUjs7O0VBQ1EsZUFBQyxPQUFEO0FBRVosUUFBQTtJQUFBLE9BQUEsR0FBVTtJQUNWLElBQUMsQ0FBQSxRQUFELEdBQ0M7TUFBQSxJQUFBLEVBQU0sSUFBQyxDQUFBLE1BQUQsQ0FBUSxPQUFPLENBQUMsSUFBaEIsRUFBc0IsS0FBdEIsQ0FBTjtNQUNBLFNBQUEsRUFBVyxJQUFDLENBQUEsTUFBRCxDQUFRLE9BQU8sQ0FBQyxTQUFoQixFQUEyQixDQUFBLENBQUUsTUFBRixDQUEzQixDQURYO01BRUEsSUFBQSxFQUFNLElBRk47TUFHQSxZQUFBLEVBQWtCLElBQUEsVUFBQSxDQUFXO1FBQzVCLFNBQUEsRUFBVyxJQUFDLENBQUEsTUFBRCxDQUFRLE9BQU8sQ0FBQyxTQUFoQixFQUEyQixDQUFBLENBQUUsTUFBRixDQUEzQixDQURpQjtRQUU1QixLQUFBLEVBQU8sT0FGcUI7T0FBWCxDQUhsQjtNQU9BLFFBQUEsRUFBVSxJQUFDLENBQUEsTUFBRCxDQUFRLE9BQU8sQ0FBQyxRQUFoQixFQUEwQixJQUExQixDQVBWOztJQVFELElBQUMsQ0FBQSxLQUFELEdBQVM7SUFFVCxJQUFDLENBQUMsRUFBRixDQUFLLGVBQUwsRUFBc0IsSUFBQyxDQUFBLE9BQXZCO0lBQ0EsSUFBQyxDQUFBLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBbkIsQ0FBc0IsZUFBdEIsRUFBdUMsSUFBQyxDQUFBLE9BQXhDO0lBRUEsSUFBQyxDQUFDLEVBQUYsQ0FBSyxrQkFBTCxFQUF5QixJQUFDLENBQUEsVUFBMUI7SUFFQSxTQUFBLEdBQVksU0FBQyxJQUFEO01BQ1gsT0FBTyxDQUFDLE9BQVIsQ0FBZ0IsSUFBaEI7YUFDQSxPQUFPLENBQUMsTUFBUixDQUFBO0lBRlc7SUFHWixRQUFRLENBQUMsSUFBVCxDQUFjLGVBQWQsRUFBK0IsU0FBL0I7RUF0Qlk7OztBQXdCYjs7OztrQkFHQSxVQUFBLEdBQVksU0FBQyxJQUFEO0FBQ1gsUUFBQTtJQUFBLE9BQUEsR0FBVTtJQUNWLE9BQU8sQ0FBQyxHQUFSLENBQVksb0JBQVosRUFBa0MsSUFBbEM7SUFLQSxTQUFBLEdBQ0M7TUFBQSxJQUFBLEVBQU0sSUFBTjs7SUFDRCxPQUFPLENBQUMsR0FBUixDQUFZLGVBQVosRUFBNkIsU0FBN0I7V0FDQSxDQUFDLENBQUMsSUFBRixDQUFPO01BQ04sSUFBQSxFQUFNLE1BREE7TUFFTixHQUFBLEVBQUssT0FGQztNQUdOLElBQUEsRUFBTSxTQUhBO01BSU4sT0FBQSxFQUFTLFNBQUMsSUFBRDtRQUNSLE9BQU8sQ0FBQyxHQUFSLENBQVksSUFBWjtlQUNBLE9BQU8sQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQTlCLENBQW1DLHVCQUFuQyxFQUE0RCxFQUE1RDtNQUZRLENBSkg7TUFPTixLQUFBLEVBQU8sU0FBQyxJQUFEO1FBQ04sT0FBTyxDQUFDLEdBQVIsQ0FBWSxJQUFaO2VBQ0EsT0FBTyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBOUIsQ0FBbUMsdUJBQW5DLEVBQTRELEVBQTVEO01BRk0sQ0FQRDtLQUFQO0VBVlc7OztBQXNCWjs7Ozs7O2tCQUtBLE9BQUEsR0FBUyxTQUFDLElBQUQ7QUFDUixRQUFBO0lBQUEsUUFBQSxHQUFXO0lBQ1gsS0FBQSxHQUFRO0lBQ1IsR0FBQSxHQUFNO0lBQ04sSUFBRywwQkFBQSxJQUFzQixRQUFBLENBQVMsSUFBSyxDQUFBLFVBQUEsQ0FBZCxDQUFBLEtBQThCLEdBQXZEO01BQ0MsSUFBRyxzQkFBQSxJQUFrQixJQUFLLENBQUEsTUFBQSxDQUFPLENBQUMsTUFBYixHQUFzQixDQUEzQztRQUNDLENBQUMsQ0FBQyxJQUFGLENBQU8sSUFBSyxDQUFBLE1BQUEsQ0FBWixFQUFxQixTQUFDLENBQUQsRUFBSSxDQUFKO2lCQUNwQixLQUFLLENBQUMsSUFBTixDQUFXO1lBQ1YsRUFBQSxFQUFJLENBQUMsQ0FBQyxFQURJO1lBRVYsU0FBQSxFQUFXLENBQUMsQ0FBQyxTQUZIO1lBR1YsSUFBQSxFQUFNLENBQUMsQ0FBQyxJQUhFO1lBSVYsTUFBQSxFQUFRLENBQUMsQ0FBQyxNQUpBO1lBS1YsT0FBQSxFQUFTLENBQUMsQ0FBQyxPQUxEO1lBTVYsT0FBQSxFQUFTLENBQUMsQ0FBQyxPQU5EO1dBQVg7UUFEb0IsQ0FBckIsRUFERDtPQUFBLE1BQUE7UUFXQyxPQUFPLENBQUMsR0FBUixDQUFZLHlCQUFaO1FBQ0EsUUFBQSxHQUFXLE1BWlo7T0FERDtLQUFBLE1BQUE7TUFlQyxPQUFPLENBQUMsR0FBUixDQUFZLGtCQUFaO01BQ0EsUUFBQSxHQUFXO01BQ1gsR0FBQSxHQUFTLG1CQUFILEdBQXFCLElBQUssQ0FBQSxLQUFBLENBQTFCLEdBQXNDLHNCQWpCN0M7O0lBa0JBLElBQUMsQ0FBQSxLQUFELEdBQ0M7TUFBQSxRQUFBLEVBQVUsUUFBVjtNQUNBLEtBQUEsRUFBTyxLQURQOztJQUVELFdBQVcsQ0FBQyxLQUFaLEdBQW9CO0FBQ3BCLFdBQU87RUExQkM7OztBQTRCVDs7OztrQkFHQSxNQUFBLEdBQVEsU0FBQyxHQUFELEVBQU0sUUFBTjtJQUNBLElBQUcsV0FBSDthQUFhLElBQWI7S0FBQSxNQUFBO2FBQXNCLFNBQXRCOztFQURBOzs7QUFHUjs7Ozs7a0JBSUEsTUFBQSxHQUFRLFNBQUE7SUFDUCxJQUFHLElBQUMsQ0FBQSxLQUFLLENBQUMsUUFBVjthQUVDLElBQUMsQ0FBQSxRQUFRLENBQUMsWUFBWSxDQUFDLElBQXZCLENBQTRCLHVCQUE1QixFQUFxRCxJQUFDLENBQUEsS0FBdEQsRUFGRDtLQUFBLE1BQUE7YUFJQyxPQUFPLENBQUMsR0FBUixDQUFZLFVBQVosRUFKRDs7RUFETzs7O0FBT1I7Ozs7OztrQkFLQSxPQUFBLEdBQVMsU0FBQyxRQUFEO1dBQ1IsQ0FBQyxDQUFDLElBQUYsQ0FBTztNQUNOLElBQUEsRUFBTSxLQURBO01BRU4sUUFBQSxFQUFVLE1BRko7TUFHTixHQUFBLEVBQUssVUFIQztNQUlOLE9BQUEsRUFBUyxTQUFDLElBQUQ7ZUFDUixRQUFBLENBQVMsSUFBVDtNQURRLENBSkg7TUFNTixLQUFBLEVBQU8sU0FBQyxJQUFEO1FBQ04sT0FBTyxDQUFDLEdBQVIsQ0FBWSxPQUFaLEVBQXFCLElBQXJCO2VBQ0EsUUFBQSxDQUFTLElBQVQ7TUFGTSxDQU5EO0tBQVA7RUFEUTs7a0JBWVQsSUFBQSxHQUFNLFNBQUE7V0FDTCxJQUFDLENBQUEsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFwQixDQUFBO0VBREs7O2tCQUdOLElBQUEsR0FBTSxTQUFBO1dBQ0wsSUFBQyxDQUFBLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBcEIsQ0FBQTtFQURLOzs7O0dBeEhhOztBQTZIZDs7O0VBQ1Esb0JBQUMsT0FBRDtBQUNaLFFBQUE7SUFBQSxPQUFBLEdBQVU7SUFDVixJQUFDLENBQUEsUUFBRCxHQUNDO01BQUEsSUFBQSxFQUFNLFlBQU47TUFDQSxTQUFBLEVBQVcsSUFBQyxDQUFBLE1BQUQsQ0FBUSxPQUFPLENBQUMsU0FBaEIsRUFBMkIsQ0FBQSxDQUFFLE1BQUYsQ0FBM0IsQ0FEWDtNQUVBLFFBQUEsRUFBVSxJQUFDLENBQUEsTUFBRCxDQUFRLE9BQU8sQ0FBQyxRQUFoQixFQUEwQixRQUExQixDQUZWO01BR0EsS0FBQSxFQUFPLElBSFA7TUFJQSxLQUFBLEVBQU8sSUFKUDtNQUtBLEtBQUEsRUFBTyxJQUFDLENBQUEsTUFBRCxDQUFRLE9BQU8sQ0FBQyxLQUFoQixFQUF1QixFQUF2QixDQUxQOztJQU1ELElBQUMsQ0FBQyxFQUFGLENBQUssdUJBQUwsRUFBOEIsT0FBTyxDQUFDLE1BQXRDO0lBQ0EsSUFBQyxDQUFBLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBbkIsQ0FBc0IsdUJBQXRCLEVBQStDLE9BQU8sQ0FBQyxNQUF2RDtJQUNBLElBQUMsQ0FBQyxFQUFGLENBQUssdUJBQUwsRUFBOEIsT0FBTyxDQUFDLFVBQXRDO0lBQ0EsSUFBQyxDQUFBLElBQUQsQ0FBQTtFQVpZOzt1QkFlYixVQUFBLEdBQVksU0FBQyxHQUFEO0lBQ1gsT0FBTyxDQUFDLEdBQVIsQ0FBWSw2QkFBWixFQUEyQyxHQUEzQztJQUNBLENBQUEsQ0FBRSxhQUFGLENBQWdCLENBQUMsSUFBakIsQ0FBc0IsTUFBdEI7V0FDQSxDQUFBLENBQUUsYUFBRixDQUFnQixDQUFDLElBQWpCLENBQXNCLE9BQXRCLEVBQStCLE1BQS9CO0VBSFc7O3VCQUtaLElBQUEsR0FBTSxTQUFBO0FBQ0wsUUFBQTtJQUFBLFVBQUEsR0FBYTtJQWlDYixLQUFBLEdBQVEsQ0FBQSxDQUFFLFVBQUY7SUFDUixJQUFDLENBQUEsUUFBUSxDQUFDLFNBQVMsQ0FBQyxNQUFwQixDQUEyQixLQUEzQjtJQUNBLElBQUMsQ0FBQSxRQUFRLENBQUMsS0FBVixHQUFrQjtJQUNsQixPQUFBLEdBQVU7SUFHVixLQUFLLENBQUMsSUFBTixDQUFXLG1CQUFYLENBQStCLENBQUMsY0FBaEMsQ0FBK0M7TUFDOUMsSUFBQSxFQUFNLElBRHdDO01BRTlDLE1BQUEsRUFBUSxPQUZzQztNQUc5QyxVQUFBLEVBQVksS0FIa0M7TUFJOUMsZ0JBQUEsRUFBa0IsU0FBQyxNQUFELEVBQVMsS0FBVCxFQUFnQixLQUFoQixHQUFBLENBSjRCO01BYTlDLE1BQUEsRUFBUSxTQUFDLE1BQUQsR0FBQSxDQWJzQztLQUEvQztJQWdCQSxLQUFLLENBQUMsSUFBTixDQUFXLG1CQUFYLENBQStCLENBQUMsRUFBaEMsQ0FBbUMsT0FBbkMsRUFBNEMsU0FBQyxDQUFEO0FBQzNDLFVBQUE7TUFBQSxLQUFBLEdBQVEsQ0FBQSxDQUFFLElBQUYsQ0FBTyxDQUFDLE9BQVIsQ0FBZ0IsbUJBQWhCO01BQ1IsSUFBQSxHQUFPLEtBQUssQ0FBQyxJQUFOLENBQVcsbUJBQVgsQ0FBK0IsQ0FBQyxHQUFoQyxDQUFBO01BQ1AsSUFBQSxHQUFPLEtBQUssQ0FBQyxJQUFOLENBQVcsbUJBQVgsQ0FBK0IsQ0FBQyxHQUFoQyxDQUFBO01BQ1AsSUFBQSxHQUFPLEtBQUssQ0FBQyxJQUFOLENBQVcsbUJBQVgsQ0FBK0IsQ0FBQyxHQUFoQyxDQUFBO01BQ1AsT0FBTyxDQUFDLEdBQVIsQ0FBWSxZQUFaLEVBQTBCLElBQTFCLEVBQWdDLElBQWhDLEVBQXNDLElBQXRDO01BQ0EsSUFBRyxJQUFBLEtBQVEsRUFBUixJQUFjLElBQUEsS0FBUSxFQUF0QixJQUE0QixJQUFBLEtBQVEsRUFBdkM7UUFDQyxLQUFBLENBQU0sYUFBTixFQUREOztNQUVBLElBQUcsS0FBQSxDQUFNLElBQU4sQ0FBSDtlQUNDLEtBQUEsQ0FBTSxVQUFOLEVBREQ7T0FBQSxNQUFBO1FBR0MsU0FBQSxHQUNDO1VBQUEsSUFBQSxFQUFNLElBQU47VUFDQSxNQUFBLEVBQVEsSUFEUjtVQUVBLE9BQUEsRUFBUyxJQUZUO1VBR0EsT0FBQSxFQUFTLENBSFQ7O2VBSUQsQ0FBQyxDQUFDLElBQUYsQ0FBTztVQUNOLElBQUEsRUFBTSxNQURBO1VBRU4sR0FBQSxFQUFLLE1BRkM7VUFHTixJQUFBLEVBQU0sU0FIQTtVQUlOLE9BQUEsRUFBUyxTQUFDLElBQUQ7WUFDUixPQUFPLENBQUMsR0FBUixDQUFZLFVBQVosRUFBd0IsSUFBeEI7WUFDQSxJQUFHLElBQUksQ0FBQyxRQUFMLEtBQWlCLEtBQXBCO2NBQ0MsS0FBQSxDQUFNLE1BQU4sRUFERDthQUFBLE1BQUE7Y0FHQyxLQUFBLENBQU0sTUFBTixFQUhEOzttQkFJQSxRQUFRLENBQUMsTUFBVCxDQUFBO1VBTlEsQ0FKSDtVQVdOLEtBQUEsRUFBTyxTQUFDLElBQUQ7WUFDTixLQUFBLENBQU0sTUFBTjttQkFDQSxRQUFRLENBQUMsTUFBVCxDQUFBO1VBRk0sQ0FYRDtTQUFQLEVBUkQ7O0lBUjJDLENBQTVDO0lBaUNBLEtBQUssQ0FBQyxJQUFOLENBQVcsYUFBWCxDQUF5QixDQUFDLEVBQTFCLENBQTZCLE9BQTdCLEVBQXNDLFNBQUMsQ0FBRDtBQUNyQyxVQUFBO01BQUEsT0FBTyxDQUFDLEdBQVIsQ0FBWSxtQkFBWjtNQUNBLElBQUcsQ0FBQSxDQUFFLElBQUYsQ0FBTyxDQUFDLElBQVIsQ0FBYSxPQUFiLENBQUEsS0FBeUIsTUFBNUI7UUFHQyxDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLE1BQWI7UUFDQSxDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLE9BQWIsRUFBc0IsTUFBdEI7UUFFQSxDQUFBLENBQUUsWUFBRixDQUFlLENBQUMsY0FBaEIsQ0FBK0I7VUFDOUIsSUFBQSxFQUFNLElBRHdCO1VBRTlCLE1BQUEsRUFBUSxZQUZzQjtVQUc5QixVQUFBLEVBQVksS0FIa0I7VUFJOUIsZ0JBQUEsRUFBa0IsU0FBQyxNQUFELEVBQVMsS0FBVCxFQUFnQixLQUFoQjtBQUVqQixnQkFBQTtZQUFBLE9BQU8sQ0FBQyxHQUFSLENBQVksU0FBWixFQUF1QixNQUFNLENBQUMsVUFBUCxDQUFBLENBQXZCLEVBQTRDLE1BQU0sQ0FBQyxZQUFQLENBQUEsQ0FBNUMsRUFBbUUsTUFBTSxDQUFDLGtCQUFQLENBQUEsQ0FBbkUsRUFBZ0csTUFBTSxDQUFDLGNBQVAsQ0FBQSxDQUFoRyxFQUF5SCxNQUFNLENBQUMsV0FBUCxDQUFBLENBQXpIO1lBR0EsUUFBQSxHQUFXLE1BQU0sQ0FBQyxrQkFBUCxDQUFBO1lBQ1gsUUFBQSxHQUFXLFFBQVEsQ0FBQyxLQUFULENBQWUsR0FBZixDQUFtQixDQUFDLElBQXBCLENBQXlCLEdBQXpCO21CQUNYLEtBQUssQ0FBQyxJQUFOLENBQVcsUUFBWDtVQVBpQixDQUpZO1VBYTlCLE1BQUEsRUFBUSxTQUFDLE1BQUQ7bUJBQ1AsT0FBTyxDQUFDLEdBQVIsQ0FBWSxTQUFaO1VBRE8sQ0Fic0I7U0FBL0I7UUFnQkEsU0FBQSxHQUFZLFNBQUMsQ0FBRDtBQUNYLGNBQUE7VUFBQSxJQUFHLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQWEsT0FBYixDQUFxQixDQUFDLE1BQXRCLEtBQWdDLENBQW5DO1lBQ0MsR0FBQSxHQUFNLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQUE7WUFDTixDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLEtBQWIsRUFBb0IsR0FBcEI7WUFDQSxVQUFBLEdBQWEsMkRBQUEsR0FBeUQsR0FBekQsR0FBNkQ7bUJBQzFFLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQWEsVUFBYixFQUpEOztRQURXO1FBTVosQ0FBQSxDQUFFLFlBQUYsQ0FBZSxDQUFDLEVBQWhCLENBQW1CLE9BQW5CLEVBQTRCLFNBQTVCO1FBQ0EsU0FBQSxHQUFZLFNBQUMsQ0FBRDtBQUNYLGNBQUE7VUFBQSxJQUFHLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQWEsT0FBYixDQUFxQixDQUFDLE1BQXRCLEtBQWdDLENBQW5DO1lBQ0MsR0FBQSxHQUFNLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQUE7WUFDTixDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLEtBQWIsRUFBb0IsR0FBcEI7WUFDQSxVQUFBLEdBQWEsMkRBQUEsR0FBeUQsR0FBekQsR0FBNkQ7bUJBQzFFLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQWEsVUFBYixFQUpEOztRQURXO1FBTVosQ0FBQSxDQUFFLFlBQUYsQ0FBZSxDQUFDLEVBQWhCLENBQW1CLE9BQW5CLEVBQTRCLFNBQTVCO1FBRUEsQ0FBQSxDQUFFLG9CQUFGLENBQXVCLENBQUMsV0FBeEIsQ0FBb0MsY0FBcEM7ZUFDQSxDQUFBLENBQUUsZUFBRixDQUFrQixDQUFDLFdBQW5CLENBQStCLGNBQS9CLEVBdENEO09BQUEsTUFBQTtRQTBDQyxDQUFBLENBQUUsWUFBRixDQUFlLENBQUMsY0FBaEIsQ0FBK0IsU0FBL0I7UUFDQSxDQUFDLENBQUMsSUFBRixDQUFPLENBQUEsQ0FBRSxZQUFGLENBQVAsRUFBd0IsU0FBQyxDQUFELEVBQUksQ0FBSjtBQUN2QixjQUFBO1VBQUEsTUFBQSxHQUFTLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQWEsT0FBYjtVQUNULElBQUcsTUFBTSxDQUFDLE1BQVAsS0FBaUIsQ0FBcEI7WUFFQyxPQUFBLEdBQVUsTUFBTSxDQUFDLEdBQVAsQ0FBQTtZQUNWLE9BQU8sQ0FBQyxHQUFSLENBQVksQ0FBQSxDQUFFLElBQUYsQ0FBWixFQUFxQixDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLEtBQWIsQ0FBckIsRUFBMEMsT0FBMUM7WUFDQSxHQUFBLEdBQU07WUFFTixJQUFHLEdBQUcsQ0FBQyxJQUFKLENBQVMsT0FBVCxDQUFBLEtBQXFCLElBQXhCO2NBQ0MsT0FBTyxDQUFDLEdBQVIsQ0FBWSwwQkFBWixFQUF3QyxPQUF4QztxQkFDQSxDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLE9BQWIsRUFGRDthQUFBLE1BQUE7Y0FJQyxPQUFPLENBQUMsR0FBUixDQUFZLE9BQVosRUFBcUIsOEJBQXJCO3FCQUNBLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxJQUFSLENBQWEsQ0FBQSxDQUFFLElBQUYsQ0FBTyxDQUFDLElBQVIsQ0FBYSxLQUFiLENBQWIsRUFMRDthQU5EOztRQUZ1QixDQUF4QjtRQWNBLENBQUMsQ0FBQyxJQUFGLENBQU8sQ0FBQSxDQUFFLFlBQUYsQ0FBUCxFQUF3QixTQUFDLENBQUQsRUFBSSxDQUFKO0FBQ3ZCLGNBQUE7VUFBQSxNQUFBLEdBQVMsQ0FBQSxDQUFFLElBQUYsQ0FBTyxDQUFDLElBQVIsQ0FBYSxPQUFiO1VBQ1QsSUFBRyxNQUFNLENBQUMsTUFBUCxLQUFpQixDQUFwQjtZQUNDLE9BQUEsR0FBVSxNQUFNLENBQUMsR0FBUCxDQUFBO1lBQ1YsSUFBRyxPQUFBLEtBQVcsRUFBZDtxQkFDQyxDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLE9BQWIsRUFERDthQUFBLE1BQUE7cUJBR0MsQ0FBQSxDQUFFLElBQUYsQ0FBTyxDQUFDLElBQVIsQ0FBYSxDQUFBLENBQUUsSUFBRixDQUFPLENBQUMsSUFBUixDQUFhLEtBQWIsQ0FBYixFQUhEO2FBRkQ7O1FBRnVCLENBQXhCO1FBVUEsT0FBTyxDQUFDLEdBQVIsQ0FBWSxXQUFaLEVBQXlCLE9BQU8sQ0FBQyxRQUFqQztRQUVBLE9BQUEsR0FBVSxPQUFPLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUEzQixDQUFnQyxVQUFoQztRQUNWLFdBQUEsR0FBYztRQUNkLENBQUMsQ0FBQyxJQUFGLENBQU8sT0FBUCxFQUFnQixTQUFDLENBQUQsRUFBSSxDQUFKO0FBQ2YsY0FBQTtVQUFBLElBQUEsR0FBTyxPQUFPLENBQUMsRUFBUixDQUFXLENBQVgsQ0FBYSxDQUFDLElBQWQsQ0FBbUIsWUFBbkIsQ0FBZ0MsQ0FBQyxJQUFqQyxDQUFBO1VBQ1AsSUFBQSxHQUFPLE9BQU8sQ0FBQyxFQUFSLENBQVcsQ0FBWCxDQUFhLENBQUMsSUFBZCxDQUFtQixZQUFuQixDQUFnQyxDQUFDLElBQWpDLENBQUE7VUFDUCxJQUFBLEdBQU8sT0FBTyxDQUFDLEVBQVIsQ0FBVyxDQUFYLENBQWEsQ0FBQyxJQUFkLENBQW1CLFlBQW5CLENBQWdDLENBQUMsSUFBakMsQ0FBQTtVQUNQLEVBQUEsR0FBSyxPQUFPLENBQUMsRUFBUixDQUFXLENBQVgsQ0FBYSxDQUFDLElBQWQsQ0FBbUIsS0FBbkI7aUJBQ0wsV0FBVyxDQUFDLElBQVosQ0FBaUI7WUFDaEIsRUFBQSxFQUFJLEVBRFk7WUFFaEIsSUFBQSxFQUFPLElBRlM7WUFHaEIsTUFBQSxFQUFTLElBSE87WUFJaEIsT0FBQSxFQUFVLElBSk07V0FBakI7UUFMZSxDQUFoQjtRQVdBLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBakIsR0FBeUI7UUFDekIsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBdkIsQ0FBNEIsa0JBQTVCLEVBQWdELE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBakU7UUFFQSxDQUFBLENBQUUsWUFBRixDQUFlLENBQUMsTUFBaEIsQ0FBdUIsT0FBdkI7UUFDQSxDQUFBLENBQUUsWUFBRixDQUFlLENBQUMsTUFBaEIsQ0FBdUIsT0FBdkI7UUFFQSxDQUFBLENBQUUsb0JBQUYsQ0FBdUIsQ0FBQyxRQUF4QixDQUFpQyxjQUFqQztlQUNBLENBQUEsQ0FBRSxlQUFGLENBQWtCLENBQUMsUUFBbkIsQ0FBNEIsY0FBNUIsRUF6RkQ7O0lBRnFDLENBQXRDO0lBNkZBLEtBQUssQ0FBQyxJQUFOLENBQVcsWUFBWCxDQUF3QixDQUFDLEVBQXpCLENBQTRCLE9BQTVCLEVBQXFDLFNBQUMsQ0FBRDtNQUNwQyxPQUFPLENBQUMsR0FBUixDQUFZLG9CQUFaO2FBQ0EsT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBM0IsQ0FBZ0MsbUJBQWhDLENBQW9ELENBQUMsSUFBckQsQ0FBQTtJQUZvQyxDQUFyQztXQUlBLEtBQUssQ0FBQyxJQUFOLENBQVcsT0FBWCxDQUFtQixDQUFDLEVBQXBCLENBQXVCLE9BQXZCLEVBQWdDLGVBQWhDLEVBQWlELFNBQUMsQ0FBRDtBQUNoRCxVQUFBO01BQUEsSUFBQSxHQUFPLENBQUEsQ0FBRSxJQUFGLENBQU8sQ0FBQyxPQUFSLENBQWdCLElBQWhCO01BQ1AsVUFBQSxHQUFhLElBQUksQ0FBQyxJQUFMLENBQVUsS0FBVjtNQUNiLFNBQUEsR0FDQztRQUFBLFVBQUEsRUFBWSxVQUFaOzthQUNELENBQUMsQ0FBQyxJQUFGLENBQU87UUFDTixJQUFBLEVBQU0sTUFEQTtRQUVOLEdBQUEsRUFBSyxNQUZDO1FBR04sSUFBQSxFQUFNLFNBSEE7UUFJTixPQUFBLEVBQVMsU0FBQyxJQUFEO1VBQ1IsSUFBRyxJQUFJLENBQUMsUUFBTCxLQUFpQixLQUFwQjtZQUNDLE9BQU8sQ0FBQyxHQUFSLENBQVksWUFBWjttQkFDQSxJQUFJLENBQUMsTUFBTCxDQUFBLEVBRkQ7V0FBQSxNQUFBO21CQUlDLE9BQU8sQ0FBQyxHQUFSLENBQVksYUFBWixFQUpEOztRQURRLENBSkg7UUFVTixLQUFBLEVBQU8sU0FBQyxJQUFEO2lCQUNOLE9BQU8sQ0FBQyxHQUFSLENBQVksYUFBWjtRQURNLENBVkQ7T0FBUDtJQUxnRCxDQUFqRDtFQTFMSzs7dUJBNk1OLE1BQUEsR0FBUSxTQUFDLEdBQUQsRUFBTSxRQUFOO0lBQ0EsSUFBRyxXQUFIO2FBQWEsSUFBYjtLQUFBLE1BQUE7YUFBc0IsU0FBdEI7O0VBREE7O3VCQUdSLE1BQUEsR0FBUSxTQUFDLEtBQUQ7QUFDUCxRQUFBO0lBQUEsT0FBQSxHQUFVO0lBQ1YsSUFBQyxDQUFBLFFBQVEsQ0FBQyxLQUFWLEdBQWtCO0lBQ2xCLE9BQU8sQ0FBQyxHQUFSLENBQVksS0FBWjtJQUNBLFVBQUEsR0FBYTtJQUNiLENBQUMsQ0FBQyxJQUFGLENBQU8sS0FBSyxDQUFDLEtBQWIsRUFBb0IsU0FBQyxDQUFELEVBQUksQ0FBSjtBQUNuQixVQUFBO01BQUEsS0FBQSxHQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBUCxDQUFhLENBQWIsRUFBZ0IsRUFBaEI7TUFDUixLQUFBLEdBQVEsQ0FBQyxDQUFDO01BQ1YsS0FBQSxHQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBVixDQUFlLEdBQWY7TUFDUixHQUFBLEdBQU0sQ0FBQyxDQUFDO01BQ1IsU0FBQSxHQUFZLFlBQUEsR0FDQSxHQURBLEdBQ0ksZ0NBREosR0FFYyxLQUZkLEdBRW9CLGtDQUZwQixHQUdjLEtBSGQsR0FHb0Isa0NBSHBCLEdBSWMsS0FKZCxHQUlvQjthQUloQyxVQUFBLElBQWM7SUFiSyxDQUFwQjtXQWNBLElBQUMsQ0FBQSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQWhCLENBQXFCLE9BQXJCLENBQTZCLENBQUMsSUFBOUIsQ0FBbUMsVUFBbkM7RUFuQk87Ozs7R0FyT2dCOztBQTJQbkI7OztFQUNRLHVCQUFDLE9BQUQ7SUFDWixJQUFDLENBQUEsUUFBRCxHQUNDO01BQUEsU0FBQSxFQUFXLElBQUMsQ0FBQSxNQUFELENBQVEsT0FBTyxDQUFDLFNBQWhCLEVBQTJCLENBQUEsQ0FBRSxNQUFGLENBQTNCLENBQVg7O0lBRUQsSUFBQyxDQUFBLElBQUQsQ0FBQTtFQUpZOzswQkFLYixJQUFBLEdBQU0sU0FBQTtBQUNMLFFBQUE7SUFBQSxVQUFBLEdBQWE7SUFHYixJQUFDLENBQUEsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFwQixDQUFBO0lBQ0EsSUFBQyxDQUFBLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBcEIsQ0FBeUIsVUFBekI7SUFDQSxJQUFHLFdBQVcsQ0FBQyxLQUFaLEtBQXFCLElBQXhCO01BQ0MsSUFBQyxDQUFBLFFBQVEsQ0FBQyxJQUFWLEdBQWlCLFdBQVcsQ0FBQzthQUM3QixJQUFDLENBQUEsYUFBRCxDQUFBLEVBRkQ7O0VBTks7OzBCQVNOLGFBQUEsR0FBZSxTQUFBO0FBQ2QsUUFBQTtJQUFBLElBQUcsV0FBVyxDQUFDLEtBQVosS0FBcUIsSUFBckIsSUFBNkIsT0FBTyxXQUFXLENBQUMsS0FBbkIsS0FBNEIsV0FBNUQ7QUFBQTtLQUFBLE1BQUE7TUFHQyxNQUFBLEdBQVMsV0FBVyxDQUFDO01BQ3JCLE9BQU8sQ0FBQyxHQUFSLENBQVksU0FBWixFQUF1QixNQUF2QjtNQUNBLElBQUEsR0FBTztNQUNQLElBQUEsR0FBTztBQUNQLFdBQUEsd0NBQUE7O1FBQ0MsSUFBSSxDQUFDLElBQUwsQ0FBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQVAsQ0FBYSxDQUFiLEVBQWdCLEVBQWhCLENBQVY7UUFDQSxJQUFJLENBQUMsSUFBTCxDQUFVLENBQUMsQ0FBQyxNQUFaO0FBRkQ7TUFHQSxVQUFBLEdBQWEsT0FBTyxDQUFDLElBQVIsQ0FBYSxDQUFBLENBQUUsdUJBQUYsQ0FBMkIsQ0FBQSxDQUFBLENBQXhDO01BQ2IsT0FBTyxDQUFDLEdBQVIsQ0FBWSxJQUFaLEVBQWtCLElBQWxCO01BVUEsTUFBQSxHQUFTO1FBQ1IsS0FBQSxFQUFPO1VBQ04sQ0FBQSxFQUFHLFFBREc7VUFFTixJQUFBLEVBQU0sTUFGQTtTQURDO1FBS1IsTUFBQSxFQUFRO1VBQ1AsR0FBQSxFQUFLLFFBREU7VUFFUCxJQUFBLEVBQUssQ0FBQyxJQUFELENBRkU7U0FMQTtRQVNSLE9BQUEsRUFBUztVQUNSLElBQUEsRUFBTSxJQURFO1VBRVIsT0FBQSxFQUFTO1lBQ1IsSUFBQSxFQUFNO2NBQUMsSUFBQSxFQUFNLElBQVA7YUFERTtZQUVSLFFBQUEsRUFBVTtjQUFDLElBQUEsRUFBTSxJQUFQO2NBQWEsUUFBQSxFQUFVLEtBQXZCO2FBRkY7WUFHUixTQUFBLEVBQVc7Y0FBQyxJQUFBLEVBQU0sSUFBUDtjQUFhLElBQUEsRUFBTSxDQUFDLE1BQUQsRUFBUyxLQUFULEVBQWdCLE9BQWhCLEVBQXlCLE9BQXpCLENBQW5CO2FBSEg7WUFJUixPQUFBLEVBQVM7Y0FBQyxJQUFBLEVBQU0sSUFBUDthQUpEO1lBS1IsV0FBQSxFQUFhO2NBQUMsSUFBQSxFQUFNLElBQVA7YUFMTDtXQUZEO1NBVEQ7UUFtQlIsS0FBQSxFQUFPO1VBQ047WUFDQyxJQUFBLEVBQU0sVUFEUDtZQUVDLFdBQUEsRUFBYSxLQUZkO1lBR0MsSUFBQSxFQUFNLElBSFA7V0FETTtTQW5CQztRQTBCUixLQUFBLEVBQU87VUFDTjtZQUNDLElBQUEsRUFBTSxPQURQO1dBRE07U0ExQkM7UUFnQ1IsUUFBQSxFQUFVO1VBQ1QsSUFBQSxFQUFNLFFBREc7VUFFVCxLQUFBLEVBQU8sRUFGRTtVQUdULEdBQUEsRUFBSyxFQUhJO1NBaENGO1FBcUNSLE1BQUEsRUFBUTtVQUNQO1lBQ0MsSUFBQSxFQUFLLElBRE47WUFFQyxJQUFBLEVBQUssTUFGTjtZQUdDLE1BQUEsRUFBTyxJQUhSO1lBSUMsTUFBQSxFQUFRLE1BSlQ7WUFLQyxLQUFBLEVBQU8sR0FMUjtZQU1DLFNBQUEsRUFBVztjQUNWLE1BQUEsRUFBUSxFQURFO2FBTlo7WUFTQyxJQUFBLEVBQU0sSUFUUDtXQURPO1NBckNBOzthQW9EVCxVQUFVLENBQUMsU0FBWCxDQUFxQixNQUFyQixFQXpFRDs7RUFEYzs7O0FBNEVmOzs7OzBCQUdBLE1BQUEsR0FBUSxTQUFDLEdBQUQsRUFBTSxRQUFOO0lBQ0EsSUFBRyxXQUFIO2FBQWEsSUFBYjtLQUFBLE1BQUE7YUFBc0IsU0FBdEI7O0VBREE7OzBCQUdSLElBQUEsR0FBTSxTQUFBO0lBQ0wsSUFBQyxDQUFBLGFBQUQsQ0FBQTtXQUNBLElBQUMsQ0FBQSxRQUFRLENBQUMsU0FBUyxDQUFDLElBQXBCLENBQUE7RUFGSzs7MEJBSU4sSUFBQSxHQUFNLFNBQUE7V0FDTCxJQUFDLENBQUEsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFwQixDQUFBO0VBREs7Ozs7R0FyR3FCOztBQTBHdEI7OztFQUNRLHdCQUFDLE9BQUQ7SUFDWixJQUFDLENBQUEsUUFBRCxHQUNDO01BQUEsU0FBQSxFQUFXLElBQUMsQ0FBQSxNQUFELENBQVEsT0FBTyxDQUFDLFNBQWhCLEVBQTJCLENBQUEsQ0FBRSxNQUFGLENBQTNCLENBQVg7O0lBQ0QsSUFBQyxDQUFBLElBQUQsQ0FBQTtFQUhZOzsyQkFJYixJQUFBLEdBQU0sU0FBQTtJQUNMLElBQUcsV0FBVyxDQUFDLEtBQVosS0FBcUIsSUFBeEI7TUFDQyxJQUFDLENBQUEsUUFBUSxDQUFDLElBQVYsR0FBaUIsV0FBVyxDQUFDO2FBQzdCLElBQUMsQ0FBQSxjQUFELENBQUEsRUFGRDs7RUFESzs7MkJBSU4sTUFBQSxHQUFRLFNBQUE7SUFDUCxJQUFHLFdBQVcsQ0FBQyxLQUFaLEtBQXFCLElBQXhCO01BQ0MsSUFBQyxDQUFBLFFBQVEsQ0FBQyxJQUFWLEdBQWlCLFdBQVcsQ0FBQzthQUM3QixJQUFDLENBQUEsY0FBRCxDQUFBLEVBRkQ7O0VBRE87OzJCQUtSLGNBQUEsR0FBZ0IsU0FBQTtXQUNmLE9BQU8sQ0FBQyxHQUFSLENBQVksd0JBQVo7RUFEZTs7O0FBRWhCOzs7OzJCQUdBLE1BQUEsR0FBUSxTQUFDLEdBQUQsRUFBTSxRQUFOO0lBQ0EsSUFBRyxXQUFIO2FBQWEsSUFBYjtLQUFBLE1BQUE7YUFBc0IsU0FBdEI7O0VBREE7OzJCQUVSLElBQUEsR0FBTSxTQUFBO0lBQ0wsSUFBQyxDQUFBLE1BQUQsQ0FBQTtXQUNBLElBQUMsQ0FBQSxRQUFRLENBQUMsU0FBUyxDQUFDLElBQXBCLENBQUE7RUFGSzs7MkJBSU4sSUFBQSxHQUFNLFNBQUE7V0FDTCxJQUFDLENBQUEsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFwQixDQUFBO0VBREs7Ozs7R0F6QnNCOztBQTRCN0IsT0FBQSxHQUNDO0VBQUEsSUFBQSxFQUFNLEtBQU47RUFDQSxTQUFBLEVBQVcsQ0FBQSxDQUFFLDJEQUFGLENBRFg7RUFFQSxRQUFBLEVBQVUsUUFGVjs7O0FBSUQsTUFBQSxHQUFhLElBQUEsS0FBQSxDQUFNLE9BQU47O0FBR2IsWUFBQSxHQUNDO0VBQUEsU0FBQSxFQUFXLENBQUEsQ0FBRSx3REFBRixDQUFYOzs7QUFDRCxLQUFBLEdBQVksSUFBQSxhQUFBLENBQWMsWUFBZDs7QUFJWixDQUFBLENBQUUsZUFBRixDQUFrQixDQUFDLEVBQW5CLENBQXNCLE9BQXRCLEVBQStCLFNBQUMsQ0FBRDtFQUM5QixPQUFPLENBQUMsR0FBUixDQUFZLHNCQUFaO0VBQ0EsTUFBTSxDQUFDLElBQVAsQ0FBQTtTQUNBLEtBQUssQ0FBQyxJQUFOLENBQUE7QUFIOEIsQ0FBL0I7O0FBS0EsQ0FBQSxDQUFFLGVBQUYsQ0FBa0IsQ0FBQyxFQUFuQixDQUFzQixPQUF0QixFQUErQixTQUFDLENBQUQ7RUFDOUIsT0FBTyxDQUFDLEdBQVIsQ0FBWSxtQkFBWjtFQUNBLE1BQU0sQ0FBQyxJQUFQLENBQUE7U0FDQSxLQUFLLENBQUMsSUFBTixDQUFBO0FBSDhCLENBQS9COztBQUtBLENBQUEsQ0FBRSxlQUFGLENBQWtCLENBQUMsRUFBbkIsQ0FBc0IsT0FBdEIsRUFBK0IsU0FBQyxDQUFEO0VBQzlCLE9BQU8sQ0FBQyxHQUFSLENBQVksY0FBWjtFQUNBLE1BQU0sQ0FBQyxJQUFQLENBQUE7U0FDQSxLQUFLLENBQUMsSUFBTixDQUFBO0FBSDhCLENBQS9CIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIVxyXG4gKiBFdmVudEVtaXR0ZXIyXHJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9oaWoxbngvRXZlbnRFbWl0dGVyMlxyXG4gKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgaGlqMW54XHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cclxuICovXHJcbjshZnVuY3Rpb24odW5kZWZpbmVkKSB7XHJcblxyXG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSA/IEFycmF5LmlzQXJyYXkgOiBmdW5jdGlvbiBfaXNBcnJheShvYmopIHtcclxuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xyXG4gIH07XHJcbiAgdmFyIGRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcclxuXHJcbiAgZnVuY3Rpb24gaW5pdCgpIHtcclxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xyXG4gICAgaWYgKHRoaXMuX2NvbmYpIHtcclxuICAgICAgY29uZmlndXJlLmNhbGwodGhpcywgdGhpcy5fY29uZik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBjb25maWd1cmUoY29uZikge1xyXG4gICAgaWYgKGNvbmYpIHtcclxuXHJcbiAgICAgIHRoaXMuX2NvbmYgPSBjb25mO1xyXG5cclxuICAgICAgY29uZi5kZWxpbWl0ZXIgJiYgKHRoaXMuZGVsaW1pdGVyID0gY29uZi5kZWxpbWl0ZXIpO1xyXG4gICAgICBjb25mLm1heExpc3RlbmVycyAmJiAodGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IGNvbmYubWF4TGlzdGVuZXJzKTtcclxuICAgICAgY29uZi53aWxkY2FyZCAmJiAodGhpcy53aWxkY2FyZCA9IGNvbmYud2lsZGNhcmQpO1xyXG4gICAgICBjb25mLm5ld0xpc3RlbmVyICYmICh0aGlzLm5ld0xpc3RlbmVyID0gY29uZi5uZXdMaXN0ZW5lcik7XHJcblxyXG4gICAgICBpZiAodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICAgIHRoaXMubGlzdGVuZXJUcmVlID0ge307XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIEV2ZW50RW1pdHRlcihjb25mKSB7XHJcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcclxuICAgIHRoaXMubmV3TGlzdGVuZXIgPSBmYWxzZTtcclxuICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIGNvbmYpO1xyXG4gIH1cclxuXHJcbiAgLy9cclxuICAvLyBBdHRlbnRpb24sIGZ1bmN0aW9uIHJldHVybiB0eXBlIG5vdyBpcyBhcnJheSwgYWx3YXlzICFcclxuICAvLyBJdCBoYXMgemVybyBlbGVtZW50cyBpZiBubyBhbnkgbWF0Y2hlcyBmb3VuZCBhbmQgb25lIG9yIG1vcmVcclxuICAvLyBlbGVtZW50cyAobGVhZnMpIGlmIHRoZXJlIGFyZSBtYXRjaGVzXHJcbiAgLy9cclxuICBmdW5jdGlvbiBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIGkpIHtcclxuICAgIGlmICghdHJlZSkge1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcbiAgICB2YXIgbGlzdGVuZXJzPVtdLCBsZWFmLCBsZW4sIGJyYW5jaCwgeFRyZWUsIHh4VHJlZSwgaXNvbGF0ZWRCcmFuY2gsIGVuZFJlYWNoZWQsXHJcbiAgICAgICAgdHlwZUxlbmd0aCA9IHR5cGUubGVuZ3RoLCBjdXJyZW50VHlwZSA9IHR5cGVbaV0sIG5leHRUeXBlID0gdHlwZVtpKzFdO1xyXG4gICAgaWYgKGkgPT09IHR5cGVMZW5ndGggJiYgdHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgIC8vXHJcbiAgICAgIC8vIElmIGF0IHRoZSBlbmQgb2YgdGhlIGV2ZW50KHMpIGxpc3QgYW5kIHRoZSB0cmVlIGhhcyBsaXN0ZW5lcnNcclxuICAgICAgLy8gaW52b2tlIHRob3NlIGxpc3RlbmVycy5cclxuICAgICAgLy9cclxuICAgICAgaWYgKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVycyk7XHJcbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBmb3IgKGxlYWYgPSAwLCBsZW4gPSB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoOyBsZWFmIDwgbGVuOyBsZWFmKyspIHtcclxuICAgICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzW2xlYWZdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICgoY3VycmVudFR5cGUgPT09ICcqJyB8fCBjdXJyZW50VHlwZSA9PT0gJyoqJykgfHwgdHJlZVtjdXJyZW50VHlwZV0pIHtcclxuICAgICAgLy9cclxuICAgICAgLy8gSWYgdGhlIGV2ZW50IGVtaXR0ZWQgaXMgJyonIGF0IHRoaXMgcGFydFxyXG4gICAgICAvLyBvciB0aGVyZSBpcyBhIGNvbmNyZXRlIG1hdGNoIGF0IHRoaXMgcGF0Y2hcclxuICAgICAgLy9cclxuICAgICAgaWYgKGN1cnJlbnRUeXBlID09PSAnKicpIHtcclxuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XHJcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XHJcbiAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xyXG4gICAgICB9IGVsc2UgaWYoY3VycmVudFR5cGUgPT09ICcqKicpIHtcclxuICAgICAgICBlbmRSZWFjaGVkID0gKGkrMSA9PT0gdHlwZUxlbmd0aCB8fCAoaSsyID09PSB0eXBlTGVuZ3RoICYmIG5leHRUeXBlID09PSAnKicpKTtcclxuICAgICAgICBpZihlbmRSZWFjaGVkICYmIHRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgLy8gVGhlIG5leHQgZWxlbWVudCBoYXMgYSBfbGlzdGVuZXJzLCBhZGQgaXQgdG8gdGhlIGhhbmRsZXJzLlxyXG4gICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIHR5cGVMZW5ndGgpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcclxuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcclxuICAgICAgICAgICAgaWYoYnJhbmNoID09PSAnKicgfHwgYnJhbmNoID09PSAnKionKSB7XHJcbiAgICAgICAgICAgICAgaWYodHJlZVticmFuY2hdLl9saXN0ZW5lcnMgJiYgIWVuZFJlYWNoZWQpIHtcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIHR5cGVMZW5ndGgpKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xyXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMikpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIC8vIE5vIG1hdGNoIG9uIHRoaXMgb25lLCBzaGlmdCBpbnRvIHRoZSB0cmVlIGJ1dCBub3QgaW4gdGhlIHR5cGUgYXJyYXkuXHJcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2N1cnJlbnRUeXBlXSwgaSsxKSk7XHJcbiAgICB9XHJcblxyXG4gICAgeFRyZWUgPSB0cmVlWycqJ107XHJcbiAgICBpZiAoeFRyZWUpIHtcclxuICAgICAgLy9cclxuICAgICAgLy8gSWYgdGhlIGxpc3RlbmVyIHRyZWUgd2lsbCBhbGxvdyBhbnkgbWF0Y2ggZm9yIHRoaXMgcGFydCxcclxuICAgICAgLy8gdGhlbiByZWN1cnNpdmVseSBleHBsb3JlIGFsbCBicmFuY2hlcyBvZiB0aGUgdHJlZVxyXG4gICAgICAvL1xyXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHhUcmVlLCBpKzEpO1xyXG4gICAgfVxyXG5cclxuICAgIHh4VHJlZSA9IHRyZWVbJyoqJ107XHJcbiAgICBpZih4eFRyZWUpIHtcclxuICAgICAgaWYoaSA8IHR5cGVMZW5ndGgpIHtcclxuICAgICAgICBpZih4eFRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIGxpc3RlbmVyIG9uIGEgJyoqJywgaXQgd2lsbCBjYXRjaCBhbGwsIHNvIGFkZCBpdHMgaGFuZGxlci5cclxuICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEJ1aWxkIGFycmF5cyBvZiBtYXRjaGluZyBuZXh0IGJyYW5jaGVzIGFuZCBvdGhlcnMuXHJcbiAgICAgICAgZm9yKGJyYW5jaCBpbiB4eFRyZWUpIHtcclxuICAgICAgICAgIGlmKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHh4VHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XHJcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcclxuICAgICAgICAgICAgICAvLyBXZSBrbm93IHRoZSBuZXh0IGVsZW1lbnQgd2lsbCBtYXRjaCwgc28ganVtcCB0d2ljZS5cclxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzIpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBjdXJyZW50VHlwZSkge1xyXG4gICAgICAgICAgICAgIC8vIEN1cnJlbnQgbm9kZSBtYXRjaGVzLCBtb3ZlIGludG8gdGhlIHRyZWUuXHJcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsxKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaCA9IHt9O1xyXG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoW2JyYW5jaF0gPSB4eFRyZWVbYnJhbmNoXTtcclxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHsgJyoqJzogaXNvbGF0ZWRCcmFuY2ggfSwgaSsxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgLy8gV2UgaGF2ZSByZWFjaGVkIHRoZSBlbmQgYW5kIHN0aWxsIG9uIGEgJyoqJ1xyXG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcclxuICAgICAgfSBlbHNlIGlmKHh4VHJlZVsnKiddICYmIHh4VHJlZVsnKiddLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVsnKiddLCB0eXBlTGVuZ3RoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBsaXN0ZW5lcnM7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBncm93TGlzdGVuZXJUcmVlKHR5cGUsIGxpc3RlbmVyKSB7XHJcblxyXG4gICAgdHlwZSA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xyXG5cclxuICAgIC8vXHJcbiAgICAvLyBMb29rcyBmb3IgdHdvIGNvbnNlY3V0aXZlICcqKicsIGlmIHNvLCBkb24ndCBhZGQgdGhlIGV2ZW50IGF0IGFsbC5cclxuICAgIC8vXHJcbiAgICBmb3IodmFyIGkgPSAwLCBsZW4gPSB0eXBlLmxlbmd0aDsgaSsxIDwgbGVuOyBpKyspIHtcclxuICAgICAgaWYodHlwZVtpXSA9PT0gJyoqJyAmJiB0eXBlW2krMV0gPT09ICcqKicpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB2YXIgdHJlZSA9IHRoaXMubGlzdGVuZXJUcmVlO1xyXG4gICAgdmFyIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XHJcblxyXG4gICAgd2hpbGUgKG5hbWUpIHtcclxuXHJcbiAgICAgIGlmICghdHJlZVtuYW1lXSkge1xyXG4gICAgICAgIHRyZWVbbmFtZV0gPSB7fTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdHJlZSA9IHRyZWVbbmFtZV07XHJcblxyXG4gICAgICBpZiAodHlwZS5sZW5ndGggPT09IDApIHtcclxuXHJcbiAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IGxpc3RlbmVyO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IFt0cmVlLl9saXN0ZW5lcnMsIGxpc3RlbmVyXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoaXNBcnJheSh0cmVlLl9saXN0ZW5lcnMpKSB7XHJcblxyXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xyXG5cclxuICAgICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzLndhcm5lZCkge1xyXG5cclxuICAgICAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xyXG5cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAobSA+IDAgJiYgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCA+IG0pIHtcclxuXHJcbiAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLndhcm5lZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCk7XHJcbiAgICAgICAgICAgICAgaWYoY29uc29sZS50cmFjZSl7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9XHJcbiAgICAgIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW5cclxuICAvLyAxMCBsaXN0ZW5lcnMgYXJlIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2hcclxuICAvLyBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cclxuICAvL1xyXG4gIC8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xyXG4gIC8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmRlbGltaXRlciA9ICcuJztcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XHJcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xyXG4gICAgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IG47XHJcbiAgICBpZiAoIXRoaXMuX2NvbmYpIHRoaXMuX2NvbmYgPSB7fTtcclxuICAgIHRoaXMuX2NvbmYubWF4TGlzdGVuZXJzID0gbjtcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmV2ZW50ID0gJyc7XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBmbikge1xyXG4gICAgdGhpcy5tYW55KGV2ZW50LCAxLCBmbik7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm1hbnkgPSBmdW5jdGlvbihldmVudCwgdHRsLCBmbikge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBsaXN0ZW5lcigpIHtcclxuICAgICAgaWYgKC0tdHRsID09PSAwKSB7XHJcbiAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgfVxyXG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGxpc3RlbmVyLl9vcmlnaW4gPSBmbjtcclxuXHJcbiAgICB0aGlzLm9uKGV2ZW50LCBsaXN0ZW5lcik7XHJcblxyXG4gICAgcmV0dXJuIHNlbGY7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuXHJcbiAgICB2YXIgdHlwZSA9IGFyZ3VtZW50c1swXTtcclxuXHJcbiAgICBpZiAodHlwZSA9PT0gJ25ld0xpc3RlbmVyJyAmJiAhdGhpcy5uZXdMaXN0ZW5lcikge1xyXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcikgeyByZXR1cm4gZmFsc2U7IH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBMb29wIHRocm91Z2ggdGhlICpfYWxsKiBmdW5jdGlvbnMgYW5kIGludm9rZSB0aGVtLlxyXG4gICAgaWYgKHRoaXMuX2FsbCkge1xyXG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XHJcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcclxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICBmb3IgKGkgPSAwLCBsID0gdGhpcy5fYWxsLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xyXG4gICAgICAgIHRoaXMuX2FsbFtpXS5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cclxuICAgIGlmICh0eXBlID09PSAnZXJyb3InKSB7XHJcblxyXG4gICAgICBpZiAoIXRoaXMuX2FsbCAmJlxyXG4gICAgICAgICF0aGlzLl9ldmVudHMuZXJyb3IgJiZcclxuICAgICAgICAhKHRoaXMud2lsZGNhcmQgJiYgdGhpcy5saXN0ZW5lclRyZWUuZXJyb3IpKSB7XHJcblxyXG4gICAgICAgIGlmIChhcmd1bWVudHNbMV0gaW5zdGFuY2VvZiBFcnJvcikge1xyXG4gICAgICAgICAgdGhyb3cgYXJndW1lbnRzWzFdOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmNhdWdodCwgdW5zcGVjaWZpZWQgJ2Vycm9yJyBldmVudC5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBoYW5kbGVyO1xyXG5cclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgaGFuZGxlciA9IFtdO1xyXG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlciwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcclxuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpXHJcbiAgICAgICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAvLyBzbG93ZXJcclxuICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcclxuICAgICAgICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGhhbmRsZXIpIHtcclxuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xyXG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XHJcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcclxuXHJcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XHJcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xyXG4gICAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gKGxpc3RlbmVycy5sZW5ndGggPiAwKSB8fCAhIXRoaXMuX2FsbDtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICByZXR1cm4gISF0aGlzLl9hbGw7XHJcbiAgICB9XHJcblxyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xyXG5cclxuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aGlzLm9uQW55KHR5cGUpO1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignb24gb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuXHJcbiAgICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09IFwibmV3TGlzdGVuZXJzXCIhIEJlZm9yZVxyXG4gICAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lcnNcIi5cclxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XHJcblxyXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICBncm93TGlzdGVuZXJUcmVlLmNhbGwodGhpcywgdHlwZSwgbGlzdGVuZXIpO1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkge1xyXG4gICAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmKHR5cGVvZiB0aGlzLl9ldmVudHNbdHlwZV0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXHJcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xyXG4gICAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXHJcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcclxuXHJcbiAgICAgIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXHJcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xyXG5cclxuICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XHJcblxyXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XHJcblxyXG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcclxuICAgICAgICAgIGlmKGNvbnNvbGUudHJhY2Upe1xyXG4gICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uQW55ID0gZnVuY3Rpb24oZm4pIHtcclxuXHJcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignb25Bbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKCF0aGlzLl9hbGwpIHtcclxuICAgICAgdGhpcy5fYWxsID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQWRkIHRoZSBmdW5jdGlvbiB0byB0aGUgZXZlbnQgbGlzdGVuZXIgY29sbGVjdGlvbi5cclxuICAgIHRoaXMuX2FsbC5wdXNoKGZuKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uO1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XHJcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlTGlzdGVuZXIgb25seSB0YWtlcyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaGFuZGxlcnMsbGVhZnM9W107XHJcblxyXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuICAgICAgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIC8vIGRvZXMgbm90IHVzZSBsaXN0ZW5lcnMoKSwgc28gbm8gc2lkZSBlZmZlY3Qgb2YgY3JlYXRpbmcgX2V2ZW50c1t0eXBlXVxyXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XHJcbiAgICAgIGhhbmRsZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gICAgICBsZWFmcy5wdXNoKHtfbGlzdGVuZXJzOmhhbmRsZXJzfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XHJcbiAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xyXG4gICAgICBoYW5kbGVycyA9IGxlYWYuX2xpc3RlbmVycztcclxuICAgICAgaWYgKGlzQXJyYXkoaGFuZGxlcnMpKSB7XHJcblxyXG4gICAgICAgIHZhciBwb3NpdGlvbiA9IC0xO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGlmIChoYW5kbGVyc1tpXSA9PT0gbGlzdGVuZXIgfHxcclxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLmxpc3RlbmVyICYmIGhhbmRsZXJzW2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcclxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLl9vcmlnaW4gJiYgaGFuZGxlcnNbaV0uX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XHJcbiAgICAgICAgICAgIHBvc2l0aW9uID0gaTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAocG9zaXRpb24gPCAwKSB7XHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICAgIGxlYWYuX2xpc3RlbmVycy5zcGxpY2UocG9zaXRpb24sIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5zcGxpY2UocG9zaXRpb24sIDEpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGhhbmRsZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2UgaWYgKGhhbmRsZXJzID09PSBsaXN0ZW5lciB8fFxyXG4gICAgICAgIChoYW5kbGVycy5saXN0ZW5lciAmJiBoYW5kbGVycy5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XHJcbiAgICAgICAgKGhhbmRsZXJzLl9vcmlnaW4gJiYgaGFuZGxlcnMuX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XHJcbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5R2FyYmFnZUNvbGxlY3Qocm9vdCkge1xyXG4gICAgICBpZiAocm9vdCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocm9vdCk7XHJcbiAgICAgIGZvciAodmFyIGkgaW4ga2V5cykge1xyXG4gICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xyXG4gICAgICAgIHZhciBvYmogPSByb290W2tleV07XHJcbiAgICAgICAgaWYgKChvYmogaW5zdGFuY2VvZiBGdW5jdGlvbikgfHwgKHR5cGVvZiBvYmogIT09IFwib2JqZWN0XCIpKVxyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgcmVjdXJzaXZlbHlHYXJiYWdlQ29sbGVjdChyb290W2tleV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIGRlbGV0ZSByb290W2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZWN1cnNpdmVseUdhcmJhZ2VDb2xsZWN0KHRoaXMubGlzdGVuZXJUcmVlKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZkFueSA9IGZ1bmN0aW9uKGZuKSB7XHJcbiAgICB2YXIgaSA9IDAsIGwgPSAwLCBmbnM7XHJcbiAgICBpZiAoZm4gJiYgdGhpcy5fYWxsICYmIHRoaXMuX2FsbC5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGZucyA9IHRoaXMuX2FsbDtcclxuICAgICAgZm9yKGkgPSAwLCBsID0gZm5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmKGZuID09PSBmbnNbaV0pIHtcclxuICAgICAgICAgIGZucy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmO1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcclxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICF0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xyXG4gICAgICB2YXIgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xyXG5cclxuICAgICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XHJcbiAgICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XHJcbiAgICAgICAgbGVhZi5fbGlzdGVuZXJzID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBudWxsO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIHZhciBoYW5kbGVycyA9IFtdO1xyXG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlcnMsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XHJcbiAgICAgIHJldHVybiBoYW5kbGVycztcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xyXG5cclxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB0aGlzLl9ldmVudHNbdHlwZV0gPSBbXTtcclxuICAgIGlmICghaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XHJcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyc0FueSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuICAgIGlmKHRoaXMuX2FsbCkge1xyXG4gICAgICByZXR1cm4gdGhpcy5fYWxsO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuXHJcbiAgfTtcclxuXHJcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cclxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcclxuICAgICAgcmV0dXJuIEV2ZW50RW1pdHRlcjtcclxuICAgIH0pO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XHJcbiAgICAvLyBDb21tb25KU1xyXG4gICAgZXhwb3J0cy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBCcm93c2VyIGdsb2JhbC5cclxuICAgIHdpbmRvdy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xyXG4gIH1cclxuICBtb2R1bGUuZXhwb3J0cy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xyXG59KCk7XHJcbiIsIkVWRU5URU1JVFRFUiA9IHJlcXVpcmUoJy4vLi4vLi4vbGliL2V2ZW50ZW1pdHRlcjIvZXZlbnRlbWl0dGVyMicpLkV2ZW50RW1pdHRlcjJcclxubW9kdWxlLmV4cG9ydHMgPSBuZXcgRVZFTlRFTUlUVEVSOyIsIkV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uLy4uL2xpYi9ldmVudGVtaXR0ZXIyL2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyXHJcbmV2ZW50YnVzID0gcmVxdWlyZSgnLi4vLi4vb3duX21vZHVsZXMvZXZlbnRidXMvZXZlbnRidXMnKVxyXG4jIFBhZ2VWaXNpYmlsaXR5ID0gcmVxdWlyZSgnLi4vLi4vb3duX21vZHVsZXMvUGFnZVZpc2liaWxpdHknKVxyXG5cclxuIyDmlbDmja7kuK3lv4NcclxuZGF0YV9jZW50ZXIgPSB7fVxyXG5cclxuY2xhc3MgRmxpc3QgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcclxuXHRjb25zdHJ1Y3RvcjogKG9wdGlvbnMpLT5cclxuXHRcdCMgc3VwZXIuYXBwbHkgQCwgYXJndW1lbnRzXHJcblx0XHRjb250ZXh0ID0gQFxyXG5cdFx0QGRlZmF1bHRzID0gXHJcblx0XHRcdG5hbWU6IEBnZXRWYWwob3B0aW9ucy5uYW1lLCAnY2pqJylcclxuXHRcdFx0Y29udGFpbmVyOiBAZ2V0VmFsKG9wdGlvbnMuY29udGFpbmVyLCAkKCdib2R5JykpXHJcblx0XHRcdGVsZW06IG51bGxcclxuXHRcdFx0Zl9saXN0X3RhYmxlOiBuZXcgRkxpc3RUYWJsZSh7XHJcblx0XHRcdFx0Y29udGFpbmVyOiBAZ2V0VmFsKG9wdGlvbnMuY29udGFpbmVyLCAkKCdib2R5JykpXHJcblx0XHRcdFx0Zmxpc3Q6IGNvbnRleHRcclxuXHRcdFx0fSkgXHJcblx0XHRcdGV2ZW50YnVzOiBAZ2V0VmFsKG9wdGlvbnMuZXZlbnRidXMsIG51bGwpXHJcblx0XHRAZGF0YXMgPSBudWxsXHJcblxyXG5cdFx0QC5vbiAnRmxpc3Q6cmVxdWVzdCcsIEByZXF1ZXN0XHJcblx0XHRAZGVmYXVsdHMuZXZlbnRidXMub24gJ0ZsaXN0OnJlcXVlc3QnLCBAcmVxdWVzdFxyXG5cclxuXHRcdEAub24gJ0ZMaXN0OmRhdGFDaGFuZ2UnLCBAZGF0YUNoYW5nZVxyXG5cclxuXHRcdGNhbGxiYWNrXyA9IChkYXRhKSAtPlxyXG5cdFx0XHRjb250ZXh0LmNhbERhdGEoZGF0YSlcclxuXHRcdFx0Y29udGV4dC5yZW5kZXIoKVxyXG5cdFx0ZXZlbnRidXMuZW1pdCAnRmxpc3Q6cmVxdWVzdCcsIGNhbGxiYWNrX1xyXG5cdFxyXG5cdCMjIypcclxuXHQgKiDmm7TmlrDmlbDmja5cclxuXHQjIyNcclxuXHRkYXRhQ2hhbmdlOiAoZGF0YSkgLT5cclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHRjb25zb2xlLmxvZyAnRmxpc3Q6IGRhdGFDaGFuZ2U6JywgZGF0YVxyXG5cdFx0IyBzZXRUaW1lb3V0KCgpLT5cclxuXHRcdCMgXHRjb25zb2xlLmxvZyAndG8gZW1pdCAnXHJcblx0XHQjIFx0Y29udGV4dC5kZWZhdWx0cy5mX2xpc3RfdGFibGUuZW1pdCAnRkxpc3RUYWJsZTpkYXRhQ2hhbmdlJywge31cclxuXHRcdCMgLCA1MDAwKVxyXG5cdFx0c2VuZF9kYXRhID0gXHJcblx0XHRcdGVkaXQ6IGRhdGEgXHJcblx0XHRjb25zb2xlLmxvZygnYmVmb3JlIHNlbmQgOicsIHNlbmRfZGF0YSk7XHJcblx0XHQkLmFqYXgge1xyXG5cdFx0XHR0eXBlOiAnUE9TVCdcclxuXHRcdFx0dXJsOiAnL2VkaXQnXHJcblx0XHRcdGRhdGE6IHNlbmRfZGF0YVxyXG5cdFx0XHRzdWNjZXNzOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRjb25zb2xlLmxvZyBkYXRhIFxyXG5cdFx0XHRcdGNvbnRleHQuZGVmYXVsdHMuZl9saXN0X3RhYmxlLmVtaXQgJ0ZMaXN0VGFibGU6ZGF0YUNoYW5nZScsIHt9XHJcblx0XHRcdGVycm9yOiAoZGF0YSktPlxyXG5cdFx0XHRcdGNvbnNvbGUubG9nIGRhdGEgXHJcblx0XHRcdFx0Y29udGV4dC5kZWZhdWx0cy5mX2xpc3RfdGFibGUuZW1pdCAnRkxpc3RUYWJsZTpkYXRhQ2hhbmdlJywge31cclxuXHRcdH1cclxuXHJcblx0IyMjKlxyXG5cdCAqIOWkhOeQhuaVsOaNrlxyXG5cdCAqIEBwYXJhbSAge29ian0gZGF0YSDmnKrlpITnkIbnmoTlh73mlbBcclxuXHQgKiBAcmV0dXJuIHtib29sfSAgICAgIOaYr+WQpuWQq+acieaVsOaNrlxyXG5cdCMjI1xyXG5cdGNhbERhdGE6IChkYXRhKSAtPlxyXG5cdFx0aGFzX2RhdGEgPSB0cnVlXHJcblx0XHRmbGlzdCA9IFtdXHJcblx0XHRlcnIgPSAnJ1xyXG5cdFx0aWYgZGF0YVsncmV0X2NvZGUnXT8gYW5kIHBhcnNlSW50KGRhdGFbJ3JldF9jb2RlJ10pID09IDIwMFxyXG5cdFx0XHRpZiBkYXRhWydkYXRhJ10/IGFuZCBkYXRhWydkYXRhJ10ubGVuZ3RoID4gMFxyXG5cdFx0XHRcdCQuZWFjaCBkYXRhWydkYXRhJ10sIChpLCBlKSAtPlxyXG5cdFx0XHRcdFx0Zmxpc3QucHVzaCB7XHJcblx0XHRcdFx0XHRcdGlkOiBlLmlkXHJcblx0XHRcdFx0XHRcdGJlbG9uZ19pZDogZS5iZWxvbmdfaWRcclxuXHRcdFx0XHRcdFx0ZGF0ZTogZS5kYXRlIFxyXG5cdFx0XHRcdFx0XHRudW1iZXI6IGUubnVtYmVyXHJcblx0XHRcdFx0XHRcdHR5cGVfaWQ6IGUudHlwZV9pZFxyXG5cdFx0XHRcdFx0XHR0YWdfYXJyOiBlLnRhZ19hcnJcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGNvbnNvbGUubG9nICdkYXRhIGxlbmd0aCBsZXNzIHRoZW4gMCdcclxuXHRcdFx0XHRoYXNfZGF0YSA9IGZhbHNlXHJcblx0XHRlbHNlXHJcblx0XHRcdGNvbnNvbGUubG9nICdyZXRfY29kZSBub3QgMjAwJ1xyXG5cdFx0XHRoYXNfZGF0YSA9IGZhbHNlXHJcblx0XHRcdGVyciA9IGlmIGRhdGFbJ2VyciddPyB0aGVuIGRhdGFbJ2VyciddIGVsc2UgJ2h0dHAgc3RhdGUgbm90IDIwMCEnXHJcblx0XHRAZGF0YXMgPSBcclxuXHRcdFx0aGFzX2RhdGE6IGhhc19kYXRhXHJcblx0XHRcdGZsaXN0OiBmbGlzdFxyXG5cdFx0ZGF0YV9jZW50ZXIuZmxpc3QgPSBmbGlzdFxyXG5cdFx0cmV0dXJuIGhhc19kYXRhXHJcblxyXG5cdCMjIypcclxuXHQgKiDov5Tlm55vYmrnmoTlgLzvvIzkuI3lrZjlnKjliJnov5Tlm55kZWZhdWx0c1xyXG5cdCMjI1xyXG5cdGdldFZhbDogKG9iaiwgZGVmYXVsdHMpIC0+XHJcblx0XHRyZXR1cm4gaWYgb2JqPyB0aGVuIG9iaiBlbHNlIGRlZmF1bHRzXHJcblx0XHJcblx0IyMjKlxyXG5cdCAqIOivu+WPluWvueixoeeahGRhdGFz5bm25riy5p+T5a+56LGhXHJcblx0ICogQHJldHVybiB7b2JqfSDlvZPliY3lr7nosaFcclxuXHQjIyNcclxuXHRyZW5kZXI6ICgpIC0+XHJcblx0XHRpZiBAZGF0YXMuaGFzX2RhdGFcclxuXHRcdFx0IyBldmVudGJ1cy5lbWl0ICdGTGlzdFRhYmxlOnJlbmRlckRhdGEnLCBAZGF0YXNcclxuXHRcdFx0QGRlZmF1bHRzLmZfbGlzdF90YWJsZS5lbWl0ICdGTGlzdFRhYmxlOnJlbmRlckRhdGEnLCBAZGF0YXNcclxuXHRcdGVsc2VcclxuXHRcdFx0Y29uc29sZS5sb2cgJ+aaguaXoOaVsOaNru+8jOivt+WIm+W7uidcdFxyXG5cclxuXHQjIyMqXHJcblx0ICog6K+35rGC6LSi5Yqh5L+h5oGv5YiX6KGoXHJcblx0ICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrIOivt+axguWujOaIkOWQjuiwg+eUqOeahOWHveaVsFxyXG5cdCAqIEByZXR1cm4ge251bGx9ICAgICAgICAgICAgbm9uZVxyXG5cdCMjI1xyXG5cdHJlcXVlc3Q6IChjYWxsYmFjaykgLT5cclxuXHRcdCQuYWpheCB7XHJcblx0XHRcdHR5cGU6ICdnZXQnXHJcblx0XHRcdGRhdGFUeXBlOiAnanNvbidcclxuXHRcdFx0dXJsOiAnL2dldExpc3QnXHJcblx0XHRcdHN1Y2Nlc3M6IChkYXRhKSAtPlxyXG5cdFx0XHRcdGNhbGxiYWNrKGRhdGEpXHJcblx0XHRcdGVycm9yOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRjb25zb2xlLmxvZyAnRXJyb3InLCBkYXRhXHJcblx0XHRcdFx0Y2FsbGJhY2soZGF0YSlcclxuXHRcdFx0XHRcclxuXHRcdH1cclxuXHRzaG93OiAoKSAtPlxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5zaG93KClcclxuXHJcblx0aGlkZTogKCkgLT5cclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaGlkZSgpXHJcblxyXG4jIOi0ouWKoeihqOagvOaPkuS7tlxyXG4jIOiDveWkn+WinuWIoOW3ruaUuVxyXG5jbGFzcyBGTGlzdFRhYmxlIGV4dGVuZHMgRXZlbnRFbWl0dGVyXHJcblx0Y29uc3RydWN0b3I6IChvcHRpb25zKSAtPlxyXG5cdFx0Y29udGV4dCA9IEBcclxuXHRcdEBkZWZhdWx0cyA9IFxyXG5cdFx0XHRuYW1lOiAnRkxpc3RUYWJsZSdcclxuXHRcdFx0Y29udGFpbmVyOiBAZ2V0VmFsKG9wdGlvbnMuY29udGFpbmVyLCAkKCdib2R5JykpXHJcblx0XHRcdGV2ZW50YnVzOiBAZ2V0VmFsKG9wdGlvbnMuZXZlbnRidXMsIGV2ZW50YnVzKVxyXG5cdFx0XHR0YWJsZTogbnVsbFxyXG5cdFx0XHRkYXRhczogbnVsbFxyXG5cdFx0XHRmbGlzdDogQGdldFZhbChvcHRpb25zLmZsaXN0LCB7fSlcclxuXHRcdEAub24gJ0ZMaXN0VGFibGU6cmVuZGVyRGF0YScsIGNvbnRleHQucmVuZGVyXHJcblx0XHRAZGVmYXVsdHMuZXZlbnRidXMub24gJ0ZMaXN0VGFibGU6cmVuZGVyRGF0YScsIGNvbnRleHQucmVuZGVyXHJcblx0XHRALm9uICdGTGlzdFRhYmxlOmRhdGFDaGFuZ2UnLCBjb250ZXh0LmRhdGFDaGFuZ2VcclxuXHRcdEBpbml0KClcclxuXHQjIOaVsOaNruS/ruaUueWujOaIkOWQjlxyXG5cclxuXHRkYXRhQ2hhbmdlOiAocmVzKSAtPlxyXG5cdFx0Y29uc29sZS5sb2cgJ0ZMaXN0VGFibGU6ZGF0YWNoYW5nZSByZXM6ICcsIHJlc1xyXG5cdFx0JCgnI2VkaXQtZmxpc3QnKS50ZXh0KCdFZGl0JylcclxuXHRcdCQoJyNlZGl0LWZsaXN0JykuYXR0cigndmFsdWUnLCAnU2F2ZScpXHJcblx0IyDliJ3lp4vljJZodG1s5ZKM5pe26Ze055uR5ZCsXHJcblx0aW5pdDogKCkgLT5cclxuXHRcdHRhYmxlX2h0bWwgPSBcIlwiXCJcclxuXHRcdFx0PGRpdiBjbGFzcz1cInVpIGludmVydGVkIHNlZ21lbnRcIj5cclxuXHRcdFx0XHQ8YnV0dG9uIGNsYXNzPVwidWkgaW52ZXJ0ZWQgeWVsbG93IGJ1dHRvblwiIGlkPVwiZWRpdC1mbGlzdFwiIHZhbHVlPVwiU2F2ZVwiPkVkaXQ8L2J1dHRvbj5cclxuXHRcdFx0XHQ8YnV0dG9uIGNsYXNzPVwidWkgaW52ZXJ0ZWQgcmVkIGJ1dHRvblwiIGlkPVwiYWRkLWZsaXN0XCI+TmV3PC9idXR0b24+XHJcblx0XHRcdFx0PGRpdiBjbGFzcz1cIm5ldy1maW5hbmNlLWZvcm1cIj5cclxuXHRcdFx0XHRcdDxsYWJlbCBmb3I9XCJ0aW1lXCI+5pe26Ze0PC9sYWJlbD5cclxuXHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJ1aSBpbnB1dFwiPlxyXG5cdFx0XHRcdFx0XHQ8aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cIm5ldy1maW5hbmNlLXRpbWVcIiBkYXRlLXRpbWUtZm9ybWF0PVwiWVlZWS1tbS1kZFwiPlxyXG5cdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0XHQ8bGFiZWwgZm9yPVwiY29zdFwiPuaAu+minTwvbGFiZWw+XHJcblx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwidWkgaW5wdXRcIj5cclxuXHRcdFx0XHRcdFx0PGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJuZXctZmluYW5jZS1jb3N0XCIgY2xhc3M9XCJ1aSBpbnZlcnRlZCBpbnB1dFwiPlxyXG5cdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0XHQ8bGFiZWwgZm9yPVwidGltZVwiPuexu+WeizwvbGFiZWw+XHJcblx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwidWkgaW5wdXRcIj5cclxuXHRcdFx0XHRcdFx0PGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJuZXctZmluYW5jZS10eXBlXCIgY2xhc3M9XCJ1aSBpbnZlcnRlZCBpbnB1dFwiPlxyXG5cdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0XHQ8YnV0dG9uIGlkPVwic2F2ZS1uZXctZmluYW5jZVwiIGNsYXNzPVwidWkgYnV0dG9uXCI+5L+d5a2YPC9idXR0b24+XHJcblx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0PHRhYmxlIGNsYXNzPVwidWkgc2VsZWN0YWJsZSBpbnZlcnRlZCB0YWJsZVwiPlxyXG5cdFx0XHRcdFx0PHRoZWFkPlxyXG5cdFx0XHRcdFx0XHQ8dHI+XHJcblx0XHRcdFx0XHRcdFx0PHRoPmRhdGU8L3RoPlxyXG5cdFx0XHRcdFx0XHRcdDx0aD5jb3N0PC90aD5cclxuXHRcdFx0XHRcdFx0XHQ8dGggY2xhc3M9XCJsZWZ0IGFsaWduZWRcIj50eXBlPC90aD5cclxuXHRcdFx0XHRcdFx0XHQ8dGggY2xhc3M9XCJvcGVyYXRlLWl0ZW0taGVhZCBkaXNwbGF5LW5vbmVcIj5vcGVyYXRlPC90aD5cclxuXHRcdFx0XHRcdFx0PC90cj5cclxuXHRcdFx0XHRcdDwvdGhlYWQ+XHJcblx0XHRcdFx0XHQ8dGJvZHk+XHJcblx0XHRcdFx0XHQ8L3Rib2R5PlxyXG5cdFx0XHRcdDwvdGFibGU+XHJcblx0XHRcdDwvZGl2PlxyXG5cdFx0XCJcIlwiXHRcdFxyXG5cdFx0dGFibGUgPSAkKHRhYmxlX2h0bWwpXHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmFwcGVuZCh0YWJsZSlcclxuXHRcdEBkZWZhdWx0cy50YWJsZSA9IHRhYmxlXHJcblx0XHRjb250ZXh0ID0gQFxyXG5cdFx0XHJcblx0XHQjIOWIneWni+WMluaWsOW7uua2iOi0ueiusOW9leeahOaXtumXtOmAieaLqeWZqFxyXG5cdFx0dGFibGUuZmluZCgnI25ldy1maW5hbmNlLXRpbWUnKS5kYXRldGltZXBpY2tlcih7XHJcblx0XHRcdGxhbmc6ICdjaCdcclxuXHRcdFx0Zm9ybWF0OiAnWS1tLWQnXHJcblx0XHRcdHRpbWVwaWNrZXI6IGZhbHNlXHJcblx0XHRcdG9uQ2hhbmdlRGF0ZVRpbWU6IChwYXJhbXMsIGlucHV0LCBldmVudCkgLT5cclxuXHRcdFx0XHQjIGV2ZW50LnByZXZlbnREZWZhdWx0KClcclxuXHRcdFx0XHQjIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXHJcblx0XHRcdFx0IyBjb25zb2xlLmxvZyAnY2hhbmdlIGRhdGUhISdcclxuXHRcdFx0XHQjIGNvbnNvbGUubG9nIGFyZ3VtZW50cywgcGFyYW1zLmdldFVUQ0RhdGUoKSwgcGFyYW1zLnRvRGF0ZVN0cmluZygpLCBwYXJhbXMudG9Mb2NhbGVEYXRlU3RyaW5nKCksIHBhcmFtcy50b0xvY2FsZVN0cmluZygpLCBwYXJhbXMudG9VVENTdHJpbmcoKVxyXG5cdFx0XHRcdCMgbmV3X2RhdGUgPSBwYXJhbXMudG9Mb2NhbGVEYXRlU3RyaW5nKClcclxuXHRcdFx0XHQjIG5ld19kYXRlID0gbmV3X2RhdGUuc3BsaXQoJy8nKS5qb2luKCctJylcclxuXHRcdFx0XHQjIGNvbnNvbGUubG9nICduZXcgZGF0ZSBpcyAnLCBuZXdfZGF0ZSwgJyBhbmQgaW5wdXQgaXMgJywgaW5wdXRcclxuXHRcdFx0XHQjIGlucHV0LnZhbChuZXdfZGF0ZSlcclxuXHRcdFx0b25TaG93OiAocGFyYW1zKSAtPlxyXG5cdFx0XHRcdCMgY29uc29sZS5sb2cgYXJndW1lbnRzXHJcblx0XHR9KVxyXG5cdFx0dGFibGUuZmluZCgnI3NhdmUtbmV3LWZpbmFuY2UnKS5vbiAnY2xpY2snLCAoZSkgLT5cclxuXHRcdFx0JGZvcm0gPSAkKHRoaXMpLmNsb3Nlc3QoJy5uZXctZmluYW5jZS1mb3JtJylcclxuXHRcdFx0dGltZSA9ICRmb3JtLmZpbmQoJyNuZXctZmluYW5jZS10aW1lJykudmFsKClcclxuXHRcdFx0Y29zdCA9ICRmb3JtLmZpbmQoJyNuZXctZmluYW5jZS1jb3N0JykudmFsKClcclxuXHRcdFx0dHlwZSA9ICRmb3JtLmZpbmQoJyNuZXctZmluYW5jZS10eXBlJykudmFsKClcclxuXHRcdFx0Y29uc29sZS5sb2cgJ3Nob3cgZGF0YTonLCB0aW1lLCBjb3N0LCB0eXBlXHJcblx0XHRcdGlmIHRpbWUgPT0gJycgb3IgY29zdCA9PSAnJyBvciB0eXBlID09ICcnXHJcblx0XHRcdFx0YWxlcnQoJ+ivt+Whq+WGmeWujOaVtOeahOa2iOi0ueiusOW9le+8gScpXHJcblx0XHRcdGlmIGlzTmFOKGNvc3QpXHJcblx0XHRcdFx0YWxlcnQoJ+ivt+Whq+WGmeWQiOazleeahOmHkeminScpXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRzZW5kX2RhdGEgPSBcclxuXHRcdFx0XHRcdGRhdGU6IHRpbWVcclxuXHRcdFx0XHRcdG51bWJlcjogY29zdFxyXG5cdFx0XHRcdFx0dGFnX2FycjogdHlwZVxyXG5cdFx0XHRcdFx0dHlwZV9pZDogMFxyXG5cdFx0XHRcdCQuYWpheCh7XHJcblx0XHRcdFx0XHR0eXBlOiAnUE9TVCdcclxuXHRcdFx0XHRcdHVybDogJy9hZGQnXHJcblx0XHRcdFx0XHRkYXRhOiBzZW5kX2RhdGFcclxuXHRcdFx0XHRcdHN1Y2Nlc3M6IChkYXRhKSAtPlxyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyAnc3VjY2VzczonLCBkYXRhIFxyXG5cdFx0XHRcdFx0XHRpZiBkYXRhLnJldF9jb2RlID09ICcyMDAnXHJcblx0XHRcdFx0XHRcdFx0YWxlcnQgJ+a3u+WKoOaIkOWKnydcclxuXHRcdFx0XHRcdFx0ZWxzZSBcclxuXHRcdFx0XHRcdFx0XHRhbGVydCAn5pu05paw5aSx6LSlJ1xyXG5cdFx0XHRcdFx0XHRsb2NhdGlvbi5yZWxvYWQoKVxyXG5cdFx0XHRcdFx0ZXJyb3I6IChkYXRhKSAtPlxyXG5cdFx0XHRcdFx0XHRhbGVydCAn5re75Yqg5aSx6LSlJ1xyXG5cdFx0XHRcdFx0XHRsb2NhdGlvbi5yZWxvYWQoKVxyXG5cdFx0XHRcdFx0XHQjIGNvbnNvbGUubG9nICdlcnJvcjonLCBkYXRhXHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0IyDkv67mlLnmjInpkq7ngrnlh7vkuovku7bnm5HlkKxcclxuXHRcdHRhYmxlLmZpbmQoJyNlZGl0LWZsaXN0Jykub24gJ2NsaWNrJywgKGUpIC0+XHJcblx0XHRcdGNvbnNvbGUubG9nICdlZGl0LWZsaXN0IGNsaWNrISdcclxuXHRcdFx0aWYgJCh0aGlzKS5hdHRyKCd2YWx1ZScpID09ICdTYXZlJ1xyXG5cdFx0XHRcdCMgY2hhbmdlIHRvIGVkaXQgdmlld1xyXG5cdFx0XHRcdCMgY3JlYXRlIGRhdGV0aW1lcGlja2VyXHJcblx0XHRcdFx0JCh0aGlzKS50ZXh0KCdTYXZlJylcclxuXHRcdFx0XHQkKHRoaXMpLmF0dHIoJ3ZhbHVlJywgJ0VkaXQnKVxyXG5cdFx0XHRcdCMg5pe26Ze06YCJ5oup5Zmo55uR5ZCs5LqL5Lu2XHJcblx0XHRcdFx0JCgnLnRpbWUtaXRlbScpLmRhdGV0aW1lcGlja2VyKHtcclxuXHRcdFx0XHRcdGxhbmc6ICdjaCdcclxuXHRcdFx0XHRcdGZvcm1hdDogJ1lZWVktbW0tZGQnXHJcblx0XHRcdFx0XHR0aW1lcGlja2VyOiBmYWxzZVxyXG5cdFx0XHRcdFx0b25DaGFuZ2VEYXRlVGltZTogKHBhcmFtcywgaW5wdXQsIGV2ZW50KSAtPlxyXG5cdFx0XHRcdFx0XHQjIOWQhOenjeaXtumXtOagvOW8j1xyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyBhcmd1bWVudHMsIHBhcmFtcy5nZXRVVENEYXRlKCksIHBhcmFtcy50b0RhdGVTdHJpbmcoKSwgcGFyYW1zLnRvTG9jYWxlRGF0ZVN0cmluZygpLCBwYXJhbXMudG9Mb2NhbGVTdHJpbmcoKSwgcGFyYW1zLnRvVVRDU3RyaW5nKClcclxuXHRcdFx0XHRcdFx0IyDnm67liY3nlKjnmoTmmK8gdG9Mb2NhbGVEYXRlU3RyaW5nXHJcblx0XHRcdFx0XHRcdCMgJCh0aGlzKS50ZXh0KHBhcmFtcy50b0xvY2FsZURhdGVTdHJpbmcoKSlcclxuXHRcdFx0XHRcdFx0bmV3X2RhdGUgPSBwYXJhbXMudG9Mb2NhbGVEYXRlU3RyaW5nKClcclxuXHRcdFx0XHRcdFx0bmV3X2RhdGUgPSBuZXdfZGF0ZS5zcGxpdCgnLycpLmpvaW4oJy0nKVxyXG5cdFx0XHRcdFx0XHRpbnB1dC50ZXh0KG5ld19kYXRlKVxyXG5cclxuXHRcdFx0XHRcdG9uU2hvdzogKHBhcmFtcykgLT5cclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgYXJndW1lbnRzXHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdGNvc3RJbnB1dCA9IChlKSAtPlxyXG5cdFx0XHRcdFx0aWYgJCh0aGlzKS5maW5kKCdpbnB1dCcpLmxlbmd0aCA9PSAwXHJcblx0XHRcdFx0XHRcdG9sZCA9ICQodGhpcykudGV4dCgpXHJcblx0XHRcdFx0XHRcdCQodGhpcykuYXR0cigndmFsJywgb2xkKVxyXG5cdFx0XHRcdFx0XHRpbnB1dF9odG1sID0gXCJcIlwiPGlucHV0IGNsYXNzPVwidWkgaW52ZXJ0ZWQgaW5wdXRcIiB0eXBlPVwidGV4dFwiIHZhbHVlPVwiI3tvbGR9XCIvPlwiXCJcIlxyXG5cdFx0XHRcdFx0XHQkKHRoaXMpLmh0bWwoaW5wdXRfaHRtbClcclxuXHRcdFx0XHQkKCcuY29zdC1pdGVtJykub24gJ2NsaWNrJywgY29zdElucHV0XHJcblx0XHRcdFx0dHlwZUlucHV0ID0gKGUpIC0+XHJcblx0XHRcdFx0XHRpZiAkKHRoaXMpLmZpbmQoJ2lucHV0JykubGVuZ3RoID09IDBcclxuXHRcdFx0XHRcdFx0b2xkID0gJCh0aGlzKS50ZXh0KClcclxuXHRcdFx0XHRcdFx0JCh0aGlzKS5hdHRyKCd2YWwnLCBvbGQpXHJcblx0XHRcdFx0XHRcdGlucHV0X2h0bWwgPSBcIlwiXCI8aW5wdXQgY2xhc3M9XCJ1aSBpbnZlcnRlZCBpbnB1dFwiIHR5cGU9XCJ0ZXh0XCIgdmFsdWU9XCIje29sZH1cIi8+XCJcIlwiXHJcblx0XHRcdFx0XHRcdCQodGhpcykuaHRtbChpbnB1dF9odG1sKVxyXG5cdFx0XHRcdCQoJy50eXBlLWl0ZW0nKS5vbiAnY2xpY2snLCB0eXBlSW5wdXRcdFxyXG5cdFx0XHRcdCMg5pi+56S65Yig6Zmk55qE6YCJ6aG5XHJcblx0XHRcdFx0JCgnLm9wZXJhdGUtaXRlbS1oZWFkJykucmVtb3ZlQ2xhc3MoJ2Rpc3BsYXktbm9uZScpXHJcblx0XHRcdFx0JCgnLm9wZXJhdGUtaXRlbScpLnJlbW92ZUNsYXNzKCdkaXNwbGF5LW5vbmUnKVxyXG5cdFx0XHQjIOS/neWtmOS/ruaUueWQjueahOaVsOaNrlxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0IyDlj5bmtojml7bpl7TpgInmi6nlmahcclxuXHRcdFx0XHQkKCcudGltZS1pdGVtJykuZGF0ZXRpbWVwaWNrZXIoJ2Rlc3Ryb3knKVxyXG5cdFx0XHRcdCQuZWFjaCAkKCcuY29zdC1pdGVtJyksIChpLCBlKSAtPlxyXG5cdFx0XHRcdFx0JGlucHV0ID0gJCh0aGlzKS5maW5kKCdpbnB1dCcpXHJcblx0XHRcdFx0XHRpZiAkaW5wdXQubGVuZ3RoICE9IDBcclxuXHRcdFx0XHRcdFx0IyBuZXdfdmFsID0gJCh0aGlzKS5hdHRyKCd2YWwnKVxyXG5cdFx0XHRcdFx0XHRuZXdfdmFsID0gJGlucHV0LnZhbCgpXHJcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nICQodGhpcyksICQodGhpcykuYXR0cigndmFsJyksIG5ld192YWxcclxuXHRcdFx0XHRcdFx0cmVnID0gL15bYS16QS1aMC05XFx1NGUwMC1cXHU5ZmE1IF0rJC9cclxuXHJcblx0XHRcdFx0XHRcdGlmIHJlZy50ZXN0KG5ld192YWwpID09IHRydWVcclxuXHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZyAndHJ1ZSB3aGlsZSB0ZXN0IHRoZSByZWc6JywgbmV3X3ZhbFxyXG5cdFx0XHRcdFx0XHRcdCQodGhpcykuaHRtbChuZXdfdmFsKVxyXG5cdFx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgbmV3X3ZhbCwgJyBpcyBmYWxzZSB3aGlsZSB0ZXN0IHRoZSByZWcnXHJcblx0XHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKCQodGhpcykuYXR0cigndmFsJykpXHJcblx0XHRcdFx0JC5lYWNoICQoJy50eXBlLWl0ZW0nKSwgKGksIGUpIC0+XHJcblx0XHRcdFx0XHQkaW5wdXQgPSAkKHRoaXMpLmZpbmQoJ2lucHV0JylcclxuXHRcdFx0XHRcdGlmICRpbnB1dC5sZW5ndGggIT0gMFxyXG5cdFx0XHRcdFx0XHRuZXdfdmFsID0gJGlucHV0LnZhbCgpXHJcblx0XHRcdFx0XHRcdGlmIG5ld192YWwgIT0gJydcclxuXHRcdFx0XHRcdFx0XHQkKHRoaXMpLmh0bWwobmV3X3ZhbClcclxuXHRcdFx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0XHRcdCQodGhpcykuaHRtbCgkKHRoaXMpLmF0dHIoJ3ZhbCcpKVxyXG5cdFx0XHRcdCMgY2hhbmdlIHRvIHNhdmUgdmlld1xyXG5cdFx0XHRcdCMgcmVxdWVzdCB0byB1cGF0ZSBkYXRhXHJcblx0XHRcdFx0Y29uc29sZS5sb2cgJ2RlZmF1bHRzOicsIGNvbnRleHQuZGVmYXVsdHNcclxuXHRcdFx0XHQjIOabtOaWsOW3suS/ruaUueeahOaVsOaNru+8jOeEtuWQjuinpuWPkWZsaXN055qEZGF0YWNoYW5nZTpcclxuXHRcdFx0XHQkZl9saXN0ID0gY29udGV4dC5kZWZhdWx0cy5jb250YWluZXIuZmluZCgndGJvZHkgdHInKVxyXG5cdFx0XHRcdGZfbGlzdF9kYXRhID0gW11cclxuXHRcdFx0XHQkLmVhY2ggJGZfbGlzdCwgKGksIGUpIC0+XHJcblx0XHRcdFx0XHR0aW1lID0gJGZfbGlzdC5lcShpKS5maW5kKCcudGltZS1pdGVtJykudGV4dCgpXHJcblx0XHRcdFx0XHRjb3N0ID0gJGZfbGlzdC5lcShpKS5maW5kKCcuY29zdC1pdGVtJykudGV4dCgpXHJcblx0XHRcdFx0XHR0eXBlID0gJGZfbGlzdC5lcShpKS5maW5kKCcudHlwZS1pdGVtJykudGV4dCgpXHJcblx0XHRcdFx0XHRpZCA9ICRmX2xpc3QuZXEoaSkuYXR0cignYWx0JylcclxuXHRcdFx0XHRcdGZfbGlzdF9kYXRhLnB1c2gge1xyXG5cdFx0XHRcdFx0XHRpZDogaWRcclxuXHRcdFx0XHRcdFx0ZGF0ZSA6IHRpbWVcclxuXHRcdFx0XHRcdFx0bnVtYmVyIDogY29zdCBcclxuXHRcdFx0XHRcdFx0dGFnX2FyciA6IHR5cGVcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRjb250ZXh0LmRlZmF1bHRzLmRhdGFzID0gZl9saXN0X2RhdGFcclxuXHRcdFx0XHRjb250ZXh0LmRlZmF1bHRzLmZsaXN0LmVtaXQgJ0ZMaXN0OmRhdGFDaGFuZ2UnLCBjb250ZXh0LmRlZmF1bHRzLmRhdGFzXHJcblx0XHRcdFx0IyDlj5bmtojnu5HlrppcclxuXHRcdFx0XHQkKCcuY29zdC1pdGVtJykudW5iaW5kKCdjbGljaycpXHJcblx0XHRcdFx0JCgnLnR5cGUtaXRlbScpLnVuYmluZCgnY2xpY2snKVxyXG5cdFx0XHRcdCMg6ZqQ6JeP5Yig6Zmk6YCJ6aG5XHJcblx0XHRcdFx0JCgnLm9wZXJhdGUtaXRlbS1oZWFkJykuYWRkQ2xhc3MoJ2Rpc3BsYXktbm9uZScpXHJcblx0XHRcdFx0JCgnLm9wZXJhdGUtaXRlbScpLmFkZENsYXNzKCdkaXNwbGF5LW5vbmUnKVxyXG5cdFx0IyDmt7vliqDmjInpkq7ngrnlh7vkuovku7bnm5HlkKxcclxuXHRcdHRhYmxlLmZpbmQoJyNhZGQtZmxpc3QnKS5vbiAnY2xpY2snLCAoZSkgLT5cclxuXHRcdFx0Y29uc29sZS5sb2cgJ3RvIGFkZCBuZXcgZmluYW5jZSdcclxuXHRcdFx0Y29udGV4dC5kZWZhdWx0cy5jb250YWluZXIuZmluZCgnLm5ldy1maW5hbmNlLWZvcm0nKS5zaG93KClcclxuXHRcdCMg5Yig6Zmk5oyJ6ZKu54K55Ye75LqL5Lu255uR5ZCsXHJcblx0XHR0YWJsZS5maW5kKCd0Ym9keScpLm9uICdjbGljaycsICcub3BlcmF0ZS1pdGVtJywgKGUpIC0+XHJcblx0XHRcdHRoYXQgPSAkKHRoaXMpLmNsb3Nlc3QoJ3RyJylcclxuXHRcdFx0ZmluYW5jZV9pZCA9IHRoYXQuYXR0cignYWx0JylcclxuXHRcdFx0c2VuZF9kYXRhID0gXHJcblx0XHRcdFx0ZmluYW5jZV9pZDogZmluYW5jZV9pZFxyXG5cdFx0XHQkLmFqYXgoe1xyXG5cdFx0XHRcdHR5cGU6ICdQT1NUJ1xyXG5cdFx0XHRcdHVybDogJy9kZWwnXHJcblx0XHRcdFx0ZGF0YTogc2VuZF9kYXRhXHJcblx0XHRcdFx0c3VjY2VzczogKGRhdGEpIC0+XHJcblx0XHRcdFx0XHRpZiBkYXRhLnJldF9jb2RlID09ICcyMDAnXHJcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nICdkZWxldGUgb2shJ1xyXG5cdFx0XHRcdFx0XHR0aGF0LnJlbW92ZSgpXHJcblx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nICdkZWxldGUgZmFpbCdcclxuXHRcdFx0XHRlcnJvcjogKGRhdGEpIC0+XHJcblx0XHRcdFx0XHRjb25zb2xlLmxvZyAnZGVsZXRlIGZhaWwnXHJcblx0XHRcdH0pXHJcblxyXG5cdGdldFZhbDogKG9iaiwgZGVmYXVsdHMpIC0+XHJcblx0XHRyZXR1cm4gaWYgb2JqPyB0aGVuIG9iaiBlbHNlIGRlZmF1bHRzXHJcblxyXG5cdHJlbmRlcjogKGRhdGFzKSAtPlxyXG5cdFx0Y29udGV4dCA9IEBcclxuXHRcdEBkZWZhdWx0cy5kYXRhcyA9IGRhdGFzXHJcblx0XHRjb25zb2xlLmxvZyBkYXRhc1xyXG5cdFx0aXRlbXNfaHRtbCA9ICcnXHJcblx0XHQkLmVhY2ggZGF0YXMuZmxpc3QsIChpLCBlKSAtPlxyXG5cdFx0XHRkYXRlXyA9IGUuZGF0ZS5zbGljZSgwLCAxMClcclxuXHRcdFx0Y29zdF8gPSBlLm51bWJlclxyXG5cdFx0XHR0eXBlXyA9IGUudGFnX2Fyci5qb2luKCcgJylcclxuXHRcdFx0aWRfID0gZS5pZFxyXG5cdFx0XHRpdGVtX2h0bWwgPSBcIlwiXCJcclxuXHRcdFx0XHQ8dHIgYWx0PVwiI3tpZF99XCI+XHJcblx0XHRcdFx0XHQ8dGQgY2xhc3M9XCJ0aW1lLWl0ZW1cIj4je2RhdGVffTwvdGQ+XHJcblx0XHRcdFx0XHQ8dGQgY2xhc3M9XCJjb3N0LWl0ZW1cIj4je2Nvc3RffTwvdGQ+XHJcblx0XHRcdFx0XHQ8dGQgY2xhc3M9XCJ0eXBlLWl0ZW1cIj4je3R5cGVffTwvdGQ+XHJcblx0XHRcdFx0XHQ8dGQgY2xhc3M9XCJvcGVyYXRlLWl0ZW0gZGlzcGxheS1ub25lXCI+ZGVsZXRlPC90ZD5cclxuXHRcdFx0XHQ8L3RyPlxyXG5cdFx0XHRcIlwiXCJcclxuXHRcdFx0aXRlbXNfaHRtbCArPSBpdGVtX2h0bWxcclxuXHRcdEBkZWZhdWx0cy50YWJsZS5maW5kKCd0Ym9keScpLmh0bWwoaXRlbXNfaHRtbClcclxuXHJcbiMg5a+55pS25YWl5pSv5Ye65YGa57uf6K6h77yM5Y+v6KeG5YyWXHJcbmNsYXNzIENvc3RDaGFydFNob3cgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcclxuXHRjb25zdHJ1Y3RvcjogKG9wdGlvbnMpIC0+XHJcblx0XHRAZGVmYXVsdHMgPSBcclxuXHRcdFx0Y29udGFpbmVyOiBAZ2V0VmFsKG9wdGlvbnMuY29udGFpbmVyLCAkKCdib2R5JykpXHJcblx0XHRcdFxyXG5cdFx0QGluaXQoKVxyXG5cdGluaXQ6ICgpIC0+XHJcblx0XHRjaGFydF9odG1sID0gXCJcIlwiXHJcblx0XHRcdDxkaXYgaWQ9XCJjb3N0LWNoYXJ0LWNvbnRhaW5lclwiIGNsYXNzPVwiY2hhcnRfY29udGFpbmVyXCIgc3R5bGU9XCJ3aWR0aDogNjAwcHg7IGhlaWdodDogNDAwcHg7XCI+PC9kaXY+XHJcblx0XHRcIlwiXCJcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaGlkZSgpXHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmh0bWwoY2hhcnRfaHRtbClcclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ICE9IG51bGxcclxuXHRcdFx0QGRlZmF1bHRzLmRhdGEgPSBkYXRhX2NlbnRlci5mbGlzdFxyXG5cdFx0XHRAc2hvd0Nvc3RDaGFydCgpXHJcblx0c2hvd0Nvc3RDaGFydDogKCkgLT5cclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ID09IG51bGwgb3IgdHlwZW9mIGRhdGFfY2VudGVyLmZsaXN0ID09ICd1bmRlZmluZWQnXHJcblx0XHRcdHJldHVyblxyXG5cdFx0ZWxzZSBcclxuXHRcdFx0Zmxpc3RfID0gZGF0YV9jZW50ZXIuZmxpc3RcclxuXHRcdFx0Y29uc29sZS5sb2cgJ2ZsaXN0XzonLCBmbGlzdF9cclxuXHRcdFx0ZGF0ZSA9IFtdXHJcblx0XHRcdGRhdGEgPSBbXVxyXG5cdFx0XHRmb3IgZiBpbiBmbGlzdF9cclxuXHRcdFx0XHRkYXRlLnB1c2ggZi5kYXRlLnNsaWNlKDAsIDEwKVxyXG5cdFx0XHRcdGRhdGEucHVzaCBmLm51bWJlclxyXG5cdFx0XHRjb3N0X2NoYXJ0ID0gZWNoYXJ0cy5pbml0KCQoJyNjb3N0LWNoYXJ0LWNvbnRhaW5lcicpWzBdKVxyXG5cdFx0XHRjb25zb2xlLmxvZyBkYXRlLCBkYXRhXHJcblx0XHRcdCMgYmFzZSA9IChuZXcgRGF0ZSgyMDE1LCA5LCA0KSkudmFsdWVPZigpXHJcblx0XHRcdCMgb25lRGF5ID0gMjQgKiAzNjAwICogMTAwMFxyXG5cdFx0XHQjIGRhdGUgPSBbXVxyXG5cdFx0XHQjIGRhdGEgPSBbTWF0aC5yYW5kb20oKSAqIDE1MF1cclxuXHJcblx0XHRcdCMgZm9yIGkgaW4gWzAuLjEwMF1cclxuXHRcdFx0IyBcdG5vdyAgPSBuZXcgRGF0ZShiYXNlICs9IG9uZURheSlcclxuXHRcdFx0IyBcdGRhdGUucHVzaChbbm93LmdldEZ1bGxZZWFyKCksIG5vdy5nZXRNb250aCgpICsgMSwgbm93LmdldERhdGUoKV0uam9pbignLScpKVxyXG5cdFx0XHQjIFx0ZGF0YS5wdXNoKChNYXRoLnJhbmRvbSgpIC0gLjQpICogMjApICsgZGF0YVtpIC0gMV07XHJcblx0XHRcdG9wdGlvbiA9IHtcclxuXHRcdFx0XHR0aXRsZToge1xyXG5cdFx0XHRcdFx0eDogJ2NlbnRlcicsXHJcblx0XHRcdFx0XHR0ZXh0OiAn5pS25YWl5pSv5Ye6JyxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdGxlZ2VuZDoge1xyXG5cdFx0XHRcdFx0dG9wOiAnYm90dG9tJyxcclxuXHRcdFx0XHRcdGRhdGE6WyfmhI/lkJEnXVxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0dG9vbGJveDoge1xyXG5cdFx0XHRcdFx0c2hvdzogdHJ1ZSxcclxuXHRcdFx0XHRcdGZlYXR1cmU6IHtcclxuXHRcdFx0XHRcdFx0bWFyazoge3Nob3c6IHRydWV9LFxyXG5cdFx0XHRcdFx0XHRkYXRhVmlldzoge3Nob3c6IHRydWUsIHJlYWRPbmx5OiBmYWxzZX0sXHJcblx0XHRcdFx0XHRcdG1hZ2ljVHlwZToge3Nob3c6IHRydWUsIHR5cGU6IFsnbGluZScsICdiYXInLCAnc3RhY2snLCAndGlsZWQnXX0sXHJcblx0XHRcdFx0XHRcdHJlc3RvcmU6IHtzaG93OiB0cnVlfSxcclxuXHRcdFx0XHRcdFx0c2F2ZUFzSW1hZ2U6IHtzaG93OiB0cnVlfVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0eEF4aXM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ2NhdGVnb3J5JyxcclxuXHRcdFx0XHRcdFx0Ym91bmRhcnlHYXA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0XHRkYXRhOiBkYXRlXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XSxcclxuXHRcdFx0XHR5QXhpczogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAndmFsdWUnLFxyXG5cdFx0XHRcdFx0XHQjIG1heDogNTAwXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XSxcclxuXHRcdFx0XHRkYXRhWm9vbToge1xyXG5cdFx0XHRcdFx0dHlwZTogJ2luc2lkZScsXHJcblx0XHRcdFx0XHRzdGFydDogNjAsXHJcblx0XHRcdFx0XHRlbmQ6IDgwXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRzZXJpZXM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTon5oiQ5LqkJyxcclxuXHRcdFx0XHRcdFx0dHlwZTonbGluZScsXHJcblx0XHRcdFx0XHRcdHNtb290aDp0cnVlLFxyXG5cdFx0XHRcdFx0XHRzeW1ib2w6ICdub25lJyxcclxuXHRcdFx0XHRcdFx0c3RhY2s6ICdhJyxcclxuXHRcdFx0XHRcdFx0YXJlYVN0eWxlOiB7XHJcblx0XHRcdFx0XHRcdFx0bm9ybWFsOiB7fVxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRkYXRhOiBkYXRhXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb3N0X2NoYXJ0LnNldE9wdGlvbihvcHRpb24pXHJcblx0XHJcblx0IyMjKlxyXG5cdCAqIOi/lOWbnm9iaueahOWAvO+8jOS4jeWtmOWcqOWImei/lOWbnmRlZmF1bHRzXHJcblx0IyMjXHJcblx0Z2V0VmFsOiAob2JqLCBkZWZhdWx0cykgLT5cclxuXHRcdHJldHVybiBpZiBvYmo/IHRoZW4gb2JqIGVsc2UgZGVmYXVsdHNcclxuXHRcclxuXHRzaG93OiAoKSAtPlxyXG5cdFx0QHNob3dDb3N0Q2hhcnQoKVxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5zaG93KClcclxuXHJcblx0aGlkZTogKCkgLT5cclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaGlkZSgpXHJcblxyXG5cclxuIyDlr7nmtojotLnojIPlm7TlgZrnu5/orqHvvIzlj6/op4bljJZcclxuY2xhc3MgUmFuZ2VDaGFydFNob3cgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcclxuXHRjb25zdHJ1Y3RvcjogKG9wdGlvbnMpIC0+XHJcblx0XHRAZGVmYXVsdHMgPSBcclxuXHRcdFx0Y29udGFpbmVyOiBAZ2V0VmFsKG9wdGlvbnMuY29udGFpbmVyLCAkKCdib2R5JykpXHJcblx0XHRAaW5pdCgpXHJcblx0aW5pdDogKCkgLT5cclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ICE9IG51bGxcclxuXHRcdFx0QGRlZmF1bHRzLmRhdGEgPSBkYXRhX2NlbnRlci5mbGlzdFxyXG5cdFx0XHRAc2hvd1JhbmdlQ2hhcnQoKVxyXG5cdHVwZGF0ZTogKCkgLT5cclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ICE9IG51bGxcclxuXHRcdFx0QGRlZmF1bHRzLmRhdGEgPSBkYXRhX2NlbnRlci5mbGlzdFxyXG5cdFx0XHRAc2hvd1JhbmdlQ2hhcnQoKVxyXG5cclxuXHRzaG93UmFuZ2VDaGFydDogKCkgLT5cclxuXHRcdGNvbnNvbGUubG9nICd0byBzaG93IHNob3dSYW5nZUNoYXJ0J1xyXG5cdCMjIypcclxuXHQgKiDov5Tlm55vYmrnmoTlgLzvvIzkuI3lrZjlnKjliJnov5Tlm55kZWZhdWx0c1xyXG5cdCMjI1xyXG5cdGdldFZhbDogKG9iaiwgZGVmYXVsdHMpIC0+XHJcblx0XHRyZXR1cm4gaWYgb2JqPyB0aGVuIG9iaiBlbHNlIGRlZmF1bHRzXHJcblx0c2hvdzogKCkgLT5cclxuXHRcdEB1cGRhdGUoKVxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5zaG93KClcclxuXHJcblx0aGlkZTogKCkgLT5cclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaGlkZSgpXHJcblxyXG5vcHRpb25zID0gXHJcblx0bmFtZTogJ2NqcydcclxuXHRjb250YWluZXI6ICQoJy51aS5ncmlkLmZpbmFuY2UgLm9saXZlLnR3ZWx2ZS53aWRlLmNvbHVtbiAuZmluYW5jZS10YWJsZScpXHJcblx0ZXZlbnRidXM6IGV2ZW50YnVzXHJcblxyXG5fZmxpc3QgPSBuZXcgRmxpc3Qob3B0aW9ucylcclxuXHJcblxyXG5jb3N0X29wdGlvbnMgPSBcclxuXHRjb250YWluZXI6ICQoJy51aS5ncmlkLmZpbmFuY2UgLm9saXZlLnR3ZWx2ZS53aWRlLmNvbHVtbiAuY29zdC1jaGFydCcpXHJcbl9jb3N0ID0gbmV3IENvc3RDaGFydFNob3coY29zdF9vcHRpb25zKVxyXG5cclxuIyDovrnmoI/kuovku7bnm5HlkKxcclxuIyDmmL7npLrmtojotLnliJfooahcclxuJCgnI2ZpbmFuY2UtbGlzdCcpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdGNvbnNvbGUubG9nICd0byBzaG93IGZpbmFuY2UtbGlzdCdcdFxyXG5cdF9mbGlzdC5zaG93KClcclxuXHRfY29zdC5oaWRlKClcclxuXHJcbiQoJyNmaW5hbmNlLWNvc3QnKS5vbiAnY2xpY2snLCAoZSkgLT5cclxuXHRjb25zb2xlLmxvZyAndG8gc2hvdyBjb3N0IGFyZWEnXHJcblx0X2ZsaXN0LmhpZGUoKVxyXG5cdF9jb3N0LnNob3coKVxyXG5cclxuJCgnI2ZpbmFuY2UtdHlwZScpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdGNvbnNvbGUubG9nICd0byBzaG93IHR5cGUnXHJcblx0X2ZsaXN0LmhpZGUoKVxyXG5cdF9jb3N0LmhpZGUoKSJdfQ==
