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
var CostChartShow, EventEmitter, FListTable, Flist, RangeChartShow, _cost, _flist, _range, cost_options, data_center, eventbus, options, range_options,
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
    var chart_html;
    chart_html = "<div id=\"range-chart-container\" class=\"chart_container\" style=\"width: 600px; height: 400px;\"></div>";
    this.defaults.container.hide();
    this.defaults.container.html(chart_html);
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
    var cost_chart, f, j, k, len, len1, option, ref, t, tag_arr, tag_map;
    if (data_center.flist === null || typeof data_center.flist === 'undefined') {

    } else {
      tag_map = {};
      ref = data_center.flist;
      for (j = 0, len = ref.length; j < len; j++) {
        f = ref[j];
        tag_arr = f.tag_arr;
        for (k = 0, len1 = tag_arr.length; k < len1; k++) {
          t = tag_arr[k];
          if (tag_map[t] != null) {
            tag_map[t]++;
          } else {
            tag_map[t] = 0;
          }
        }
      }
      console.log('tag_map:', tag_map);
      cost_chart = echarts.init($('#range-chart-container')[0]);
      option = {
        backgroundColor: '#2c343c',
        title: {
          text: 'Customized Pie',
          left: 'center',
          top: 20,
          textStyle: {
            color: '#ccc'
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        visualMap: {
          show: false,
          min: 80,
          max: 600,
          inRange: {
            colorLightness: [0, 1]
          }
        },
        series: [
          {
            name: '访问来源',
            type: 'pie',
            radius: '55%',
            center: ['50%', '50%'],
            data: [
              {
                value: 335,
                name: '直接访问'
              }, {
                value: 310,
                name: '邮件营销'
              }, {
                value: 274,
                name: '联盟广告'
              }, {
                value: 235,
                name: '视频广告'
              }, {
                value: 400,
                name: '搜索引擎'
              }
            ].sort(function(a, b) {
              return a.value - b.value;
            }),
            roseType: 'angle',
            label: {
              normal: {
                textStyle: {
                  color: 'rgba(255, 255, 255, 0.3)'
                }
              }
            },
            labelLine: {
              normal: {
                lineStyle: {
                  color: 'rgba(255, 255, 255, 0.3)'
                },
                smooth: 0.2,
                length: 10,
                length2: 20
              }
            },
            itemStyle: {
              normal: {
                color: '#c23531',
                shadowBlur: 200,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }
        ]
      };
      return cost_chart.setOption(option);
    }
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

range_options = {
  container: $('.ui.grid.finance .olive.twelve.wide.column .range-chart')
};

_range = new RangeChartShow(range_options);

$('#finance-list').on('click', function(e) {
  console.log('to show finance-list');
  _flist.show();
  _cost.hide();
  return _range.hide();
});

$('#finance-cost').on('click', function(e) {
  console.log('to show cost area');
  _flist.hide();
  _cost.show();
  return _range.hide();
});

$('#finance-type').on('click', function(e) {
  console.log('to show type');
  _flist.hide();
  _cost.hide();
  return _range.show();
});



},{"../../lib/eventemitter2/eventemitter2":1,"../../own_modules/eventbus/eventbus":2}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOi9jaGVuanNoMzYvbXlkZXZlbG9wL25vZGUvbmV3ZXhwcmVzc182L3dlYmZlL2xpYi9ldmVudGVtaXR0ZXIyL2V2ZW50ZW1pdHRlcjIuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXG93bl9tb2R1bGVzXFxldmVudGJ1c1xcZXZlbnRidXMuY29mZmVlIiwiRTpcXGNoZW5qc2gzNlxcbXlkZXZlbG9wXFxub2RlXFxuZXdleHByZXNzXzZcXHdlYmZlXFxwYWdlc1xcZmxpc3RcXGZsaXN0LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JsQkEsSUFBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLHlDQUFSLENBQWtELENBQUM7O0FBQ2xFLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLElBQUk7Ozs7O0FDRHJCLElBQUEsa0pBQUE7RUFBQTs7O0FBQUEsWUFBQSxHQUFlLE9BQUEsQ0FBUSx1Q0FBUixDQUFn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Ozs7QUFDRCxLQUFBLEdBQVksSUFBQSxhQUFBLENBQWMsWUFBZDs7QUFFWixhQUFBLEdBQ0M7RUFBQSxTQUFBLEVBQVcsQ0FBQSxDQUFFLHlEQUFGLENBQVg7OztBQUNELE1BQUEsR0FBYSxJQUFBLGNBQUEsQ0FBZSxhQUFmOztBQUtiLENBQUEsQ0FBRSxlQUFGLENBQWtCLENBQUMsRUFBbkIsQ0FBc0IsT0FBdEIsRUFBK0IsU0FBQyxDQUFEO0VBQzlCLE9BQU8sQ0FBQyxHQUFSLENBQVksc0JBQVo7RUFDQSxNQUFNLENBQUMsSUFBUCxDQUFBO0VBQ0EsS0FBSyxDQUFDLElBQU4sQ0FBQTtTQUNBLE1BQU0sQ0FBQyxJQUFQLENBQUE7QUFKOEIsQ0FBL0I7O0FBS0EsQ0FBQSxDQUFFLGVBQUYsQ0FBa0IsQ0FBQyxFQUFuQixDQUFzQixPQUF0QixFQUErQixTQUFDLENBQUQ7RUFDOUIsT0FBTyxDQUFDLEdBQVIsQ0FBWSxtQkFBWjtFQUNBLE1BQU0sQ0FBQyxJQUFQLENBQUE7RUFDQSxLQUFLLENBQUMsSUFBTixDQUFBO1NBQ0EsTUFBTSxDQUFDLElBQVAsQ0FBQTtBQUo4QixDQUEvQjs7QUFNQSxDQUFBLENBQUUsZUFBRixDQUFrQixDQUFDLEVBQW5CLENBQXNCLE9BQXRCLEVBQStCLFNBQUMsQ0FBRDtFQUM5QixPQUFPLENBQUMsR0FBUixDQUFZLGNBQVo7RUFDQSxNQUFNLENBQUMsSUFBUCxDQUFBO0VBQ0EsS0FBSyxDQUFDLElBQU4sQ0FBQTtTQUNBLE1BQU0sQ0FBQyxJQUFQLENBQUE7QUFKOEIsQ0FBL0IiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohXHJcbiAqIEV2ZW50RW1pdHRlcjJcclxuICogaHR0cHM6Ly9naXRodWIuY29tL2hpajFueC9FdmVudEVtaXR0ZXIyXHJcbiAqXHJcbiAqIENvcHlyaWdodCAoYykgMjAxMyBoaWoxbnhcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxyXG4gKi9cclxuOyFmdW5jdGlvbih1bmRlZmluZWQpIHtcclxuXHJcbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5ID8gQXJyYXkuaXNBcnJheSA6IGZ1bmN0aW9uIF9pc0FycmF5KG9iaikge1xyXG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCI7XHJcbiAgfTtcclxuICB2YXIgZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xyXG5cclxuICBmdW5jdGlvbiBpbml0KCkge1xyXG4gICAgdGhpcy5fZXZlbnRzID0ge307XHJcbiAgICBpZiAodGhpcy5fY29uZikge1xyXG4gICAgICBjb25maWd1cmUuY2FsbCh0aGlzLCB0aGlzLl9jb25mKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIGNvbmZpZ3VyZShjb25mKSB7XHJcbiAgICBpZiAoY29uZikge1xyXG5cclxuICAgICAgdGhpcy5fY29uZiA9IGNvbmY7XHJcblxyXG4gICAgICBjb25mLmRlbGltaXRlciAmJiAodGhpcy5kZWxpbWl0ZXIgPSBjb25mLmRlbGltaXRlcik7XHJcbiAgICAgIGNvbmYubWF4TGlzdGVuZXJzICYmICh0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gY29uZi5tYXhMaXN0ZW5lcnMpO1xyXG4gICAgICBjb25mLndpbGRjYXJkICYmICh0aGlzLndpbGRjYXJkID0gY29uZi53aWxkY2FyZCk7XHJcbiAgICAgIGNvbmYubmV3TGlzdGVuZXIgJiYgKHRoaXMubmV3TGlzdGVuZXIgPSBjb25mLm5ld0xpc3RlbmVyKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgICAgdGhpcy5saXN0ZW5lclRyZWUgPSB7fTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gRXZlbnRFbWl0dGVyKGNvbmYpIHtcclxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xyXG4gICAgdGhpcy5uZXdMaXN0ZW5lciA9IGZhbHNlO1xyXG4gICAgY29uZmlndXJlLmNhbGwodGhpcywgY29uZik7XHJcbiAgfVxyXG5cclxuICAvL1xyXG4gIC8vIEF0dGVudGlvbiwgZnVuY3Rpb24gcmV0dXJuIHR5cGUgbm93IGlzIGFycmF5LCBhbHdheXMgIVxyXG4gIC8vIEl0IGhhcyB6ZXJvIGVsZW1lbnRzIGlmIG5vIGFueSBtYXRjaGVzIGZvdW5kIGFuZCBvbmUgb3IgbW9yZVxyXG4gIC8vIGVsZW1lbnRzIChsZWFmcykgaWYgdGhlcmUgYXJlIG1hdGNoZXNcclxuICAvL1xyXG4gIGZ1bmN0aW9uIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgaSkge1xyXG4gICAgaWYgKCF0cmVlKSB7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuICAgIHZhciBsaXN0ZW5lcnM9W10sIGxlYWYsIGxlbiwgYnJhbmNoLCB4VHJlZSwgeHhUcmVlLCBpc29sYXRlZEJyYW5jaCwgZW5kUmVhY2hlZCxcclxuICAgICAgICB0eXBlTGVuZ3RoID0gdHlwZS5sZW5ndGgsIGN1cnJlbnRUeXBlID0gdHlwZVtpXSwgbmV4dFR5cGUgPSB0eXBlW2krMV07XHJcbiAgICBpZiAoaSA9PT0gdHlwZUxlbmd0aCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcclxuICAgICAgLy9cclxuICAgICAgLy8gSWYgYXQgdGhlIGVuZCBvZiB0aGUgZXZlbnQocykgbGlzdCBhbmQgdGhlIHRyZWUgaGFzIGxpc3RlbmVyc1xyXG4gICAgICAvLyBpbnZva2UgdGhvc2UgbGlzdGVuZXJzLlxyXG4gICAgICAvL1xyXG4gICAgICBpZiAodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzKTtcclxuICAgICAgICByZXR1cm4gW3RyZWVdO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGZvciAobGVhZiA9IDAsIGxlbiA9IHRyZWUuX2xpc3RlbmVycy5sZW5ndGg7IGxlYWYgPCBsZW47IGxlYWYrKykge1xyXG4gICAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnNbbGVhZl0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gW3RyZWVdO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKChjdXJyZW50VHlwZSA9PT0gJyonIHx8IGN1cnJlbnRUeXBlID09PSAnKionKSB8fCB0cmVlW2N1cnJlbnRUeXBlXSkge1xyXG4gICAgICAvL1xyXG4gICAgICAvLyBJZiB0aGUgZXZlbnQgZW1pdHRlZCBpcyAnKicgYXQgdGhpcyBwYXJ0XHJcbiAgICAgIC8vIG9yIHRoZXJlIGlzIGEgY29uY3JldGUgbWF0Y2ggYXQgdGhpcyBwYXRjaFxyXG4gICAgICAvL1xyXG4gICAgICBpZiAoY3VycmVudFR5cGUgPT09ICcqJykge1xyXG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcclxuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcclxuICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsxKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XHJcbiAgICAgIH0gZWxzZSBpZihjdXJyZW50VHlwZSA9PT0gJyoqJykge1xyXG4gICAgICAgIGVuZFJlYWNoZWQgPSAoaSsxID09PSB0eXBlTGVuZ3RoIHx8IChpKzIgPT09IHR5cGVMZW5ndGggJiYgbmV4dFR5cGUgPT09ICcqJykpO1xyXG4gICAgICAgIGlmKGVuZFJlYWNoZWQgJiYgdHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICAvLyBUaGUgbmV4dCBlbGVtZW50IGhhcyBhIF9saXN0ZW5lcnMsIGFkZCBpdCB0byB0aGUgaGFuZGxlcnMuXHJcbiAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgdHlwZUxlbmd0aCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xyXG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xyXG4gICAgICAgICAgICBpZihicmFuY2ggPT09ICcqJyB8fCBicmFuY2ggPT09ICcqKicpIHtcclxuICAgICAgICAgICAgICBpZih0cmVlW2JyYW5jaF0uX2xpc3RlbmVycyAmJiAhZW5kUmVhY2hlZCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgdHlwZUxlbmd0aCkpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XHJcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsyKSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgLy8gTm8gbWF0Y2ggb24gdGhpcyBvbmUsIHNoaWZ0IGludG8gdGhlIHRyZWUgYnV0IG5vdCBpbiB0aGUgdHlwZSBhcnJheS5cclxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcclxuICAgICAgfVxyXG5cclxuICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbY3VycmVudFR5cGVdLCBpKzEpKTtcclxuICAgIH1cclxuXHJcbiAgICB4VHJlZSA9IHRyZWVbJyonXTtcclxuICAgIGlmICh4VHJlZSkge1xyXG4gICAgICAvL1xyXG4gICAgICAvLyBJZiB0aGUgbGlzdGVuZXIgdHJlZSB3aWxsIGFsbG93IGFueSBtYXRjaCBmb3IgdGhpcyBwYXJ0LFxyXG4gICAgICAvLyB0aGVuIHJlY3Vyc2l2ZWx5IGV4cGxvcmUgYWxsIGJyYW5jaGVzIG9mIHRoZSB0cmVlXHJcbiAgICAgIC8vXHJcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeFRyZWUsIGkrMSk7XHJcbiAgICB9XHJcblxyXG4gICAgeHhUcmVlID0gdHJlZVsnKionXTtcclxuICAgIGlmKHh4VHJlZSkge1xyXG4gICAgICBpZihpIDwgdHlwZUxlbmd0aCkge1xyXG4gICAgICAgIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICAvLyBJZiB3ZSBoYXZlIGEgbGlzdGVuZXIgb24gYSAnKionLCBpdCB3aWxsIGNhdGNoIGFsbCwgc28gYWRkIGl0cyBoYW5kbGVyLlxyXG4gICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQnVpbGQgYXJyYXlzIG9mIG1hdGNoaW5nIG5leHQgYnJhbmNoZXMgYW5kIG90aGVycy5cclxuICAgICAgICBmb3IoYnJhbmNoIGluIHh4VHJlZSkge1xyXG4gICAgICAgICAgaWYoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgeHhUcmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcclxuICAgICAgICAgICAgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xyXG4gICAgICAgICAgICAgIC8vIFdlIGtub3cgdGhlIG5leHQgZWxlbWVudCB3aWxsIG1hdGNoLCBzbyBqdW1wIHR3aWNlLlxyXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMik7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IGN1cnJlbnRUeXBlKSB7XHJcbiAgICAgICAgICAgICAgLy8gQ3VycmVudCBub2RlIG1hdGNoZXMsIG1vdmUgaW50byB0aGUgdHJlZS5cclxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzEpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoID0ge307XHJcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2hbYnJhbmNoXSA9IHh4VHJlZVticmFuY2hdO1xyXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeyAnKionOiBpc29sYXRlZEJyYW5jaCB9LCBpKzEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAvLyBXZSBoYXZlIHJlYWNoZWQgdGhlIGVuZCBhbmQgc3RpbGwgb24gYSAnKionXHJcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xyXG4gICAgICB9IGVsc2UgaWYoeHhUcmVlWycqJ10gJiYgeHhUcmVlWycqJ10uX2xpc3RlbmVycykge1xyXG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlWycqJ10sIHR5cGVMZW5ndGgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGxpc3RlbmVycztcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIGdyb3dMaXN0ZW5lclRyZWUodHlwZSwgbGlzdGVuZXIpIHtcclxuXHJcbiAgICB0eXBlID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcblxyXG4gICAgLy9cclxuICAgIC8vIExvb2tzIGZvciB0d28gY29uc2VjdXRpdmUgJyoqJywgaWYgc28sIGRvbid0IGFkZCB0aGUgZXZlbnQgYXQgYWxsLlxyXG4gICAgLy9cclxuICAgIGZvcih2YXIgaSA9IDAsIGxlbiA9IHR5cGUubGVuZ3RoOyBpKzEgPCBsZW47IGkrKykge1xyXG4gICAgICBpZih0eXBlW2ldID09PSAnKionICYmIHR5cGVbaSsxXSA9PT0gJyoqJykge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHZhciB0cmVlID0gdGhpcy5saXN0ZW5lclRyZWU7XHJcbiAgICB2YXIgbmFtZSA9IHR5cGUuc2hpZnQoKTtcclxuXHJcbiAgICB3aGlsZSAobmFtZSkge1xyXG5cclxuICAgICAgaWYgKCF0cmVlW25hbWVdKSB7XHJcbiAgICAgICAgdHJlZVtuYW1lXSA9IHt9O1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0cmVlID0gdHJlZVtuYW1lXTtcclxuXHJcbiAgICAgIGlmICh0eXBlLmxlbmd0aCA9PT0gMCkge1xyXG5cclxuICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gbGlzdGVuZXI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gW3RyZWUuX2xpc3RlbmVycywgbGlzdGVuZXJdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChpc0FycmF5KHRyZWUuX2xpc3RlbmVycykpIHtcclxuXHJcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XHJcblxyXG4gICAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMud2FybmVkKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XHJcblxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChtID4gMCAmJiB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoID4gbSkge1xyXG5cclxuICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMud2FybmVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoKTtcclxuICAgICAgICAgICAgICBpZihjb25zb2xlLnRyYWNlKXtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgIH1cclxuICAgICAgbmFtZSA9IHR5cGUuc2hpZnQoKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhblxyXG4gIC8vIDEwIGxpc3RlbmVycyBhcmUgYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaFxyXG4gIC8vIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxyXG4gIC8vXHJcbiAgLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXHJcbiAgLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZGVsaW1pdGVyID0gJy4nO1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcbiAgICB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gbjtcclxuICAgIGlmICghdGhpcy5fY29uZikgdGhpcy5fY29uZiA9IHt9O1xyXG4gICAgdGhpcy5fY29uZi5tYXhMaXN0ZW5lcnMgPSBuO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZXZlbnQgPSAnJztcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKSB7XHJcbiAgICB0aGlzLm1hbnkoZXZlbnQsIDEsIGZuKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubWFueSA9IGZ1bmN0aW9uKGV2ZW50LCB0dGwsIGZuKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxpc3RlbmVyKCkge1xyXG4gICAgICBpZiAoLS10dGwgPT09IDApIHtcclxuICAgICAgICBzZWxmLm9mZihldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgbGlzdGVuZXIuX29yaWdpbiA9IGZuO1xyXG5cclxuICAgIHRoaXMub24oZXZlbnQsIGxpc3RlbmVyKTtcclxuXHJcbiAgICByZXR1cm4gc2VsZjtcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbigpIHtcclxuXHJcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xyXG5cclxuICAgIHZhciB0eXBlID0gYXJndW1lbnRzWzBdO1xyXG5cclxuICAgIGlmICh0eXBlID09PSAnbmV3TGlzdGVuZXInICYmICF0aGlzLm5ld0xpc3RlbmVyKSB7XHJcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKSB7IHJldHVybiBmYWxzZTsgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgKl9hbGwqIGZ1bmN0aW9ucyBhbmQgaW52b2tlIHRoZW0uXHJcbiAgICBpZiAodGhpcy5fYWxsKSB7XHJcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcclxuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xyXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XHJcbiAgICAgIGZvciAoaSA9IDAsIGwgPSB0aGlzLl9hbGwubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XHJcbiAgICAgICAgdGhpcy5fYWxsW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxyXG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcclxuXHJcbiAgICAgIGlmICghdGhpcy5fYWxsICYmXHJcbiAgICAgICAgIXRoaXMuX2V2ZW50cy5lcnJvciAmJlxyXG4gICAgICAgICEodGhpcy53aWxkY2FyZCAmJiB0aGlzLmxpc3RlbmVyVHJlZS5lcnJvcikpIHtcclxuXHJcbiAgICAgICAgaWYgKGFyZ3VtZW50c1sxXSBpbnN0YW5jZW9mIEVycm9yKSB7XHJcbiAgICAgICAgICB0aHJvdyBhcmd1bWVudHNbMV07IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuY2F1Z2h0LCB1bnNwZWNpZmllZCAnZXJyb3InIGV2ZW50LlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGhhbmRsZXI7XHJcblxyXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICBoYW5kbGVyID0gW107XHJcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xyXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVyLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xyXG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSlcclxuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuICAgICAgICAgIGNhc2UgMjpcclxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgY2FzZSAzOlxyXG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIC8vIHNsb3dlclxyXG4gICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xyXG4gICAgICAgICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoaGFuZGxlcikge1xyXG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XHJcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcclxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xyXG5cclxuICAgICAgdmFyIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcclxuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XHJcbiAgICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiAobGlzdGVuZXJzLmxlbmd0aCA+IDApIHx8ICEhdGhpcy5fYWxsO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHJldHVybiAhIXRoaXMuX2FsbDtcclxuICAgIH1cclxuXHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XHJcblxyXG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRoaXMub25BbnkodHlwZSk7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbiBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xyXG5cclxuICAgIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT0gXCJuZXdMaXN0ZW5lcnNcIiEgQmVmb3JlXHJcbiAgICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyc1wiLlxyXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcclxuXHJcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIGdyb3dMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCB0eXBlLCBsaXN0ZW5lcik7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB7XHJcbiAgICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYodHlwZW9mIHRoaXMuX2V2ZW50c1t0eXBlXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XHJcbiAgICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xyXG5cclxuICAgICAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcclxuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XHJcblxyXG4gICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAobSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcclxuXHJcbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xyXG4gICAgICAgICAgaWYoY29uc29sZS50cmFjZSl7XHJcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25BbnkgPSBmdW5jdGlvbihmbikge1xyXG5cclxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbkFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYoIXRoaXMuX2FsbCkge1xyXG4gICAgICB0aGlzLl9hbGwgPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBZGQgdGhlIGZ1bmN0aW9uIHRvIHRoZSBldmVudCBsaXN0ZW5lciBjb2xsZWN0aW9uLlxyXG4gICAgdGhpcy5fYWxsLnB1c2goZm4pO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub247XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcclxuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZW1vdmVMaXN0ZW5lciBvbmx5IHRha2VzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBoYW5kbGVycyxsZWFmcz1bXTtcclxuXHJcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xyXG4gICAgICBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgLy8gZG9lcyBub3QgdXNlIGxpc3RlbmVycygpLCBzbyBubyBzaWRlIGVmZmVjdCBvZiBjcmVhdGluZyBfZXZlbnRzW3R5cGVdXHJcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcclxuICAgICAgaGFuZGxlcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XHJcbiAgICAgIGxlYWZzLnB1c2goe19saXN0ZW5lcnM6aGFuZGxlcnN9KTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcclxuICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XHJcbiAgICAgIGhhbmRsZXJzID0gbGVhZi5fbGlzdGVuZXJzO1xyXG4gICAgICBpZiAoaXNBcnJheShoYW5kbGVycykpIHtcclxuXHJcbiAgICAgICAgdmFyIHBvc2l0aW9uID0gLTE7XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgaWYgKGhhbmRsZXJzW2ldID09PSBsaXN0ZW5lciB8fFxyXG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0ubGlzdGVuZXIgJiYgaGFuZGxlcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxyXG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0uX29yaWdpbiAmJiBoYW5kbGVyc1tpXS5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcclxuICAgICAgICAgICAgcG9zaXRpb24gPSBpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChwb3NpdGlvbiA8IDApIHtcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICAgICAgbGVhZi5fbGlzdGVuZXJzLnNwbGljZShwb3NpdGlvbiwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnNwbGljZShwb3NpdGlvbiwgMSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaGFuZGxlcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSBpZiAoaGFuZGxlcnMgPT09IGxpc3RlbmVyIHx8XHJcbiAgICAgICAgKGhhbmRsZXJzLmxpc3RlbmVyICYmIGhhbmRsZXJzLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcclxuICAgICAgICAoaGFuZGxlcnMuX29yaWdpbiAmJiBoYW5kbGVycy5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcclxuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmVjdXJzaXZlbHlHYXJiYWdlQ29sbGVjdChyb290KSB7XHJcbiAgICAgIGlmIChyb290ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhyb290KTtcclxuICAgICAgZm9yICh2YXIgaSBpbiBrZXlzKSB7XHJcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XHJcbiAgICAgICAgdmFyIG9iaiA9IHJvb3Rba2V5XTtcclxuICAgICAgICBpZiAoKG9iaiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB8fCAodHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIikpXHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICBpZiAoT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICByZWN1cnNpdmVseUdhcmJhZ2VDb2xsZWN0KHJvb3Rba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgZGVsZXRlIHJvb3Rba2V5XTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJlY3Vyc2l2ZWx5R2FyYmFnZUNvbGxlY3QodGhpcy5saXN0ZW5lclRyZWUpO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmQW55ID0gZnVuY3Rpb24oZm4pIHtcclxuICAgIHZhciBpID0gMCwgbCA9IDAsIGZucztcclxuICAgIGlmIChmbiAmJiB0aGlzLl9hbGwgJiYgdGhpcy5fYWxsLmxlbmd0aCA+IDApIHtcclxuICAgICAgZm5zID0gdGhpcy5fYWxsO1xyXG4gICAgICBmb3IoaSA9IDAsIGwgPSBmbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYoZm4gPT09IGZuc1tpXSkge1xyXG4gICAgICAgICAgZm5zLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5fYWxsID0gW107XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmY7XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xyXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcclxuICAgICAgIXRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIHZhciBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XHJcblxyXG4gICAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcclxuICAgICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcclxuICAgICAgICBsZWFmLl9saXN0ZW5lcnMgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XHJcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IG51bGw7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgdmFyIGhhbmRsZXJzID0gW107XHJcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xyXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVycywgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuICAgICAgcmV0dXJuIGhhbmRsZXJzO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFtdO1xyXG4gICAgaWYgKCFpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzQW55ID0gZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgaWYodGhpcy5fYWxsKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLl9hbGw7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG5cclxuICB9O1xyXG5cclxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAgLy8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxyXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xyXG4gICAgICByZXR1cm4gRXZlbnRFbWl0dGVyO1xyXG4gICAgfSk7XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcclxuICAgIC8vIENvbW1vbkpTXHJcbiAgICBleHBvcnRzLkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIEJyb3dzZXIgZ2xvYmFsLlxyXG4gICAgd2luZG93LkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XHJcbiAgfVxyXG4gIG1vZHVsZS5leHBvcnRzLkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XHJcbn0oKTtcclxuIiwiRVZFTlRFTUlUVEVSID0gcmVxdWlyZSgnLi8uLi8uLi9saWIvZXZlbnRlbWl0dGVyMi9ldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMlxyXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBFVkVOVEVNSVRURVI7IiwiRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vLi4vbGliL2V2ZW50ZW1pdHRlcjIvZXZlbnRlbWl0dGVyMicpLkV2ZW50RW1pdHRlcjJcclxuZXZlbnRidXMgPSByZXF1aXJlKCcuLi8uLi9vd25fbW9kdWxlcy9ldmVudGJ1cy9ldmVudGJ1cycpXHJcbiMgUGFnZVZpc2liaWxpdHkgPSByZXF1aXJlKCcuLi8uLi9vd25fbW9kdWxlcy9QYWdlVmlzaWJpbGl0eScpXHJcblxyXG4jIOaVsOaNruS4reW/g1xyXG5kYXRhX2NlbnRlciA9IHt9XHJcblxyXG5jbGFzcyBGbGlzdCBleHRlbmRzIEV2ZW50RW1pdHRlclxyXG5cdGNvbnN0cnVjdG9yOiAob3B0aW9ucyktPlxyXG5cdFx0IyBzdXBlci5hcHBseSBALCBhcmd1bWVudHNcclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHRAZGVmYXVsdHMgPSBcclxuXHRcdFx0bmFtZTogQGdldFZhbChvcHRpb25zLm5hbWUsICdjamonKVxyXG5cdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdFx0ZWxlbTogbnVsbFxyXG5cdFx0XHRmX2xpc3RfdGFibGU6IG5ldyBGTGlzdFRhYmxlKHtcclxuXHRcdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdFx0XHRmbGlzdDogY29udGV4dFxyXG5cdFx0XHR9KSBcclxuXHRcdFx0ZXZlbnRidXM6IEBnZXRWYWwob3B0aW9ucy5ldmVudGJ1cywgbnVsbClcclxuXHRcdEBkYXRhcyA9IG51bGxcclxuXHJcblx0XHRALm9uICdGbGlzdDpyZXF1ZXN0JywgQHJlcXVlc3RcclxuXHRcdEBkZWZhdWx0cy5ldmVudGJ1cy5vbiAnRmxpc3Q6cmVxdWVzdCcsIEByZXF1ZXN0XHJcblxyXG5cdFx0QC5vbiAnRkxpc3Q6ZGF0YUNoYW5nZScsIEBkYXRhQ2hhbmdlXHJcblxyXG5cdFx0Y2FsbGJhY2tfID0gKGRhdGEpIC0+XHJcblx0XHRcdGNvbnRleHQuY2FsRGF0YShkYXRhKVxyXG5cdFx0XHRjb250ZXh0LnJlbmRlcigpXHJcblx0XHRldmVudGJ1cy5lbWl0ICdGbGlzdDpyZXF1ZXN0JywgY2FsbGJhY2tfXHJcblx0XHJcblx0IyMjKlxyXG5cdCAqIOabtOaWsOaVsOaNrlxyXG5cdCMjI1xyXG5cdGRhdGFDaGFuZ2U6IChkYXRhKSAtPlxyXG5cdFx0Y29udGV4dCA9IEBcclxuXHRcdGNvbnNvbGUubG9nICdGbGlzdDogZGF0YUNoYW5nZTonLCBkYXRhXHJcblx0XHQjIHNldFRpbWVvdXQoKCktPlxyXG5cdFx0IyBcdGNvbnNvbGUubG9nICd0byBlbWl0ICdcclxuXHRcdCMgXHRjb250ZXh0LmRlZmF1bHRzLmZfbGlzdF90YWJsZS5lbWl0ICdGTGlzdFRhYmxlOmRhdGFDaGFuZ2UnLCB7fVxyXG5cdFx0IyAsIDUwMDApXHJcblx0XHRzZW5kX2RhdGEgPSBcclxuXHRcdFx0ZWRpdDogZGF0YSBcclxuXHRcdGNvbnNvbGUubG9nKCdiZWZvcmUgc2VuZCA6Jywgc2VuZF9kYXRhKTtcclxuXHRcdCQuYWpheCB7XHJcblx0XHRcdHR5cGU6ICdQT1NUJ1xyXG5cdFx0XHR1cmw6ICcvZWRpdCdcclxuXHRcdFx0ZGF0YTogc2VuZF9kYXRhXHJcblx0XHRcdHN1Y2Nlc3M6IChkYXRhKSAtPlxyXG5cdFx0XHRcdGNvbnNvbGUubG9nIGRhdGEgXHJcblx0XHRcdFx0Y29udGV4dC5kZWZhdWx0cy5mX2xpc3RfdGFibGUuZW1pdCAnRkxpc3RUYWJsZTpkYXRhQ2hhbmdlJywge31cclxuXHRcdFx0ZXJyb3I6IChkYXRhKS0+XHJcblx0XHRcdFx0Y29uc29sZS5sb2cgZGF0YSBcclxuXHRcdFx0XHRjb250ZXh0LmRlZmF1bHRzLmZfbGlzdF90YWJsZS5lbWl0ICdGTGlzdFRhYmxlOmRhdGFDaGFuZ2UnLCB7fVxyXG5cdFx0fVxyXG5cclxuXHQjIyMqXHJcblx0ICog5aSE55CG5pWw5o2uXHJcblx0ICogQHBhcmFtICB7b2JqfSBkYXRhIOacquWkhOeQhueahOWHveaVsFxyXG5cdCAqIEByZXR1cm4ge2Jvb2x9ICAgICAg5piv5ZCm5ZCr5pyJ5pWw5o2uXHJcblx0IyMjXHJcblx0Y2FsRGF0YTogKGRhdGEpIC0+XHJcblx0XHRoYXNfZGF0YSA9IHRydWVcclxuXHRcdGZsaXN0ID0gW11cclxuXHRcdGVyciA9ICcnXHJcblx0XHRpZiBkYXRhWydyZXRfY29kZSddPyBhbmQgcGFyc2VJbnQoZGF0YVsncmV0X2NvZGUnXSkgPT0gMjAwXHJcblx0XHRcdGlmIGRhdGFbJ2RhdGEnXT8gYW5kIGRhdGFbJ2RhdGEnXS5sZW5ndGggPiAwXHJcblx0XHRcdFx0JC5lYWNoIGRhdGFbJ2RhdGEnXSwgKGksIGUpIC0+XHJcblx0XHRcdFx0XHRmbGlzdC5wdXNoIHtcclxuXHRcdFx0XHRcdFx0aWQ6IGUuaWRcclxuXHRcdFx0XHRcdFx0YmVsb25nX2lkOiBlLmJlbG9uZ19pZFxyXG5cdFx0XHRcdFx0XHRkYXRlOiBlLmRhdGUgXHJcblx0XHRcdFx0XHRcdG51bWJlcjogZS5udW1iZXJcclxuXHRcdFx0XHRcdFx0dHlwZV9pZDogZS50eXBlX2lkXHJcblx0XHRcdFx0XHRcdHRhZ19hcnI6IGUudGFnX2FyclxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0Y29uc29sZS5sb2cgJ2RhdGEgbGVuZ3RoIGxlc3MgdGhlbiAwJ1xyXG5cdFx0XHRcdGhhc19kYXRhID0gZmFsc2VcclxuXHRcdGVsc2VcclxuXHRcdFx0Y29uc29sZS5sb2cgJ3JldF9jb2RlIG5vdCAyMDAnXHJcblx0XHRcdGhhc19kYXRhID0gZmFsc2VcclxuXHRcdFx0ZXJyID0gaWYgZGF0YVsnZXJyJ10/IHRoZW4gZGF0YVsnZXJyJ10gZWxzZSAnaHR0cCBzdGF0ZSBub3QgMjAwISdcclxuXHRcdEBkYXRhcyA9IFxyXG5cdFx0XHRoYXNfZGF0YTogaGFzX2RhdGFcclxuXHRcdFx0Zmxpc3Q6IGZsaXN0XHJcblx0XHRkYXRhX2NlbnRlci5mbGlzdCA9IGZsaXN0XHJcblx0XHRyZXR1cm4gaGFzX2RhdGFcclxuXHJcblx0IyMjKlxyXG5cdCAqIOi/lOWbnm9iaueahOWAvO+8jOS4jeWtmOWcqOWImei/lOWbnmRlZmF1bHRzXHJcblx0IyMjXHJcblx0Z2V0VmFsOiAob2JqLCBkZWZhdWx0cykgLT5cclxuXHRcdHJldHVybiBpZiBvYmo/IHRoZW4gb2JqIGVsc2UgZGVmYXVsdHNcclxuXHRcclxuXHQjIyMqXHJcblx0ICog6K+75Y+W5a+56LGh55qEZGF0YXPlubbmuLLmn5Plr7nosaFcclxuXHQgKiBAcmV0dXJuIHtvYmp9IOW9k+WJjeWvueixoVxyXG5cdCMjI1xyXG5cdHJlbmRlcjogKCkgLT5cclxuXHRcdGlmIEBkYXRhcy5oYXNfZGF0YVxyXG5cdFx0XHQjIGV2ZW50YnVzLmVtaXQgJ0ZMaXN0VGFibGU6cmVuZGVyRGF0YScsIEBkYXRhc1xyXG5cdFx0XHRAZGVmYXVsdHMuZl9saXN0X3RhYmxlLmVtaXQgJ0ZMaXN0VGFibGU6cmVuZGVyRGF0YScsIEBkYXRhc1xyXG5cdFx0ZWxzZVxyXG5cdFx0XHRjb25zb2xlLmxvZyAn5pqC5peg5pWw5o2u77yM6K+35Yib5bu6J1x0XHJcblxyXG5cdCMjIypcclxuXHQgKiDor7fmsYLotKLliqHkv6Hmga/liJfooahcclxuXHQgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2sg6K+35rGC5a6M5oiQ5ZCO6LCD55So55qE5Ye95pWwXHJcblx0ICogQHJldHVybiB7bnVsbH0gICAgICAgICAgICBub25lXHJcblx0IyMjXHJcblx0cmVxdWVzdDogKGNhbGxiYWNrKSAtPlxyXG5cdFx0JC5hamF4IHtcclxuXHRcdFx0dHlwZTogJ2dldCdcclxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJ1xyXG5cdFx0XHR1cmw6ICcvZ2V0TGlzdCdcclxuXHRcdFx0c3VjY2VzczogKGRhdGEpIC0+XHJcblx0XHRcdFx0Y2FsbGJhY2soZGF0YSlcclxuXHRcdFx0ZXJyb3I6IChkYXRhKSAtPlxyXG5cdFx0XHRcdGNvbnNvbGUubG9nICdFcnJvcicsIGRhdGFcclxuXHRcdFx0XHRjYWxsYmFjayhkYXRhKVxyXG5cdFx0XHRcdFxyXG5cdFx0fVxyXG5cdHNob3c6ICgpIC0+XHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLnNob3coKVxyXG5cclxuXHRoaWRlOiAoKSAtPlxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5oaWRlKClcclxuXHJcbiMg6LSi5Yqh6KGo5qC85o+S5Lu2XHJcbiMg6IO95aSf5aKe5Yig5beu5pS5XHJcbmNsYXNzIEZMaXN0VGFibGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcclxuXHRjb25zdHJ1Y3RvcjogKG9wdGlvbnMpIC0+XHJcblx0XHRjb250ZXh0ID0gQFxyXG5cdFx0QGRlZmF1bHRzID0gXHJcblx0XHRcdG5hbWU6ICdGTGlzdFRhYmxlJ1xyXG5cdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdFx0ZXZlbnRidXM6IEBnZXRWYWwob3B0aW9ucy5ldmVudGJ1cywgZXZlbnRidXMpXHJcblx0XHRcdHRhYmxlOiBudWxsXHJcblx0XHRcdGRhdGFzOiBudWxsXHJcblx0XHRcdGZsaXN0OiBAZ2V0VmFsKG9wdGlvbnMuZmxpc3QsIHt9KVxyXG5cdFx0QC5vbiAnRkxpc3RUYWJsZTpyZW5kZXJEYXRhJywgY29udGV4dC5yZW5kZXJcclxuXHRcdEBkZWZhdWx0cy5ldmVudGJ1cy5vbiAnRkxpc3RUYWJsZTpyZW5kZXJEYXRhJywgY29udGV4dC5yZW5kZXJcclxuXHRcdEAub24gJ0ZMaXN0VGFibGU6ZGF0YUNoYW5nZScsIGNvbnRleHQuZGF0YUNoYW5nZVxyXG5cdFx0QGluaXQoKVxyXG5cdCMg5pWw5o2u5L+u5pS55a6M5oiQ5ZCOXHJcblxyXG5cdGRhdGFDaGFuZ2U6IChyZXMpIC0+XHJcblx0XHRjb25zb2xlLmxvZyAnRkxpc3RUYWJsZTpkYXRhY2hhbmdlIHJlczogJywgcmVzXHJcblx0XHQkKCcjZWRpdC1mbGlzdCcpLnRleHQoJ0VkaXQnKVxyXG5cdFx0JCgnI2VkaXQtZmxpc3QnKS5hdHRyKCd2YWx1ZScsICdTYXZlJylcclxuXHQjIOWIneWni+WMlmh0bWzlkozml7bpl7Tnm5HlkKxcclxuXHRpbml0OiAoKSAtPlxyXG5cdFx0dGFibGVfaHRtbCA9IFwiXCJcIlxyXG5cdFx0XHQ8ZGl2IGNsYXNzPVwidWkgaW52ZXJ0ZWQgc2VnbWVudFwiPlxyXG5cdFx0XHRcdDxidXR0b24gY2xhc3M9XCJ1aSBpbnZlcnRlZCB5ZWxsb3cgYnV0dG9uXCIgaWQ9XCJlZGl0LWZsaXN0XCIgdmFsdWU9XCJTYXZlXCI+RWRpdDwvYnV0dG9uPlxyXG5cdFx0XHRcdDxidXR0b24gY2xhc3M9XCJ1aSBpbnZlcnRlZCByZWQgYnV0dG9uXCIgaWQ9XCJhZGQtZmxpc3RcIj5OZXc8L2J1dHRvbj5cclxuXHRcdFx0XHQ8ZGl2IGNsYXNzPVwibmV3LWZpbmFuY2UtZm9ybVwiPlxyXG5cdFx0XHRcdFx0PGxhYmVsIGZvcj1cInRpbWVcIj7ml7bpl7Q8L2xhYmVsPlxyXG5cdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpIGlucHV0XCI+XHJcblx0XHRcdFx0XHRcdDxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwibmV3LWZpbmFuY2UtdGltZVwiIGRhdGUtdGltZS1mb3JtYXQ9XCJZWVlZLW1tLWRkXCI+XHJcblx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdDxsYWJlbCBmb3I9XCJjb3N0XCI+5oC76aKdPC9sYWJlbD5cclxuXHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJ1aSBpbnB1dFwiPlxyXG5cdFx0XHRcdFx0XHQ8aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cIm5ldy1maW5hbmNlLWNvc3RcIiBjbGFzcz1cInVpIGludmVydGVkIGlucHV0XCI+XHJcblx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdDxsYWJlbCBmb3I9XCJ0aW1lXCI+57G75Z6LPC9sYWJlbD5cclxuXHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJ1aSBpbnB1dFwiPlxyXG5cdFx0XHRcdFx0XHQ8aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cIm5ldy1maW5hbmNlLXR5cGVcIiBjbGFzcz1cInVpIGludmVydGVkIGlucHV0XCI+XHJcblx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdDxidXR0b24gaWQ9XCJzYXZlLW5ldy1maW5hbmNlXCIgY2xhc3M9XCJ1aSBidXR0b25cIj7kv53lrZg8L2J1dHRvbj5cclxuXHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHQ8dGFibGUgY2xhc3M9XCJ1aSBzZWxlY3RhYmxlIGludmVydGVkIHRhYmxlXCI+XHJcblx0XHRcdFx0XHQ8dGhlYWQ+XHJcblx0XHRcdFx0XHRcdDx0cj5cclxuXHRcdFx0XHRcdFx0XHQ8dGg+ZGF0ZTwvdGg+XHJcblx0XHRcdFx0XHRcdFx0PHRoPmNvc3Q8L3RoPlxyXG5cdFx0XHRcdFx0XHRcdDx0aCBjbGFzcz1cImxlZnQgYWxpZ25lZFwiPnR5cGU8L3RoPlxyXG5cdFx0XHRcdFx0XHRcdDx0aCBjbGFzcz1cIm9wZXJhdGUtaXRlbS1oZWFkIGRpc3BsYXktbm9uZVwiPm9wZXJhdGU8L3RoPlxyXG5cdFx0XHRcdFx0XHQ8L3RyPlxyXG5cdFx0XHRcdFx0PC90aGVhZD5cclxuXHRcdFx0XHRcdDx0Ym9keT5cclxuXHRcdFx0XHRcdDwvdGJvZHk+XHJcblx0XHRcdFx0PC90YWJsZT5cclxuXHRcdFx0PC9kaXY+XHJcblx0XHRcIlwiXCJcdFx0XHJcblx0XHR0YWJsZSA9ICQodGFibGVfaHRtbClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuYXBwZW5kKHRhYmxlKVxyXG5cdFx0QGRlZmF1bHRzLnRhYmxlID0gdGFibGVcclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHRcclxuXHRcdCMg5Yid5aeL5YyW5paw5bu65raI6LS56K6w5b2V55qE5pe26Ze06YCJ5oup5ZmoXHJcblx0XHR0YWJsZS5maW5kKCcjbmV3LWZpbmFuY2UtdGltZScpLmRhdGV0aW1lcGlja2VyKHtcclxuXHRcdFx0bGFuZzogJ2NoJ1xyXG5cdFx0XHRmb3JtYXQ6ICdZLW0tZCdcclxuXHRcdFx0dGltZXBpY2tlcjogZmFsc2VcclxuXHRcdFx0b25DaGFuZ2VEYXRlVGltZTogKHBhcmFtcywgaW5wdXQsIGV2ZW50KSAtPlxyXG5cdFx0XHRcdCMgZXZlbnQucHJldmVudERlZmF1bHQoKVxyXG5cdFx0XHRcdCMgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcclxuXHRcdFx0XHQjIGNvbnNvbGUubG9nICdjaGFuZ2UgZGF0ZSEhJ1xyXG5cdFx0XHRcdCMgY29uc29sZS5sb2cgYXJndW1lbnRzLCBwYXJhbXMuZ2V0VVRDRGF0ZSgpLCBwYXJhbXMudG9EYXRlU3RyaW5nKCksIHBhcmFtcy50b0xvY2FsZURhdGVTdHJpbmcoKSwgcGFyYW1zLnRvTG9jYWxlU3RyaW5nKCksIHBhcmFtcy50b1VUQ1N0cmluZygpXHJcblx0XHRcdFx0IyBuZXdfZGF0ZSA9IHBhcmFtcy50b0xvY2FsZURhdGVTdHJpbmcoKVxyXG5cdFx0XHRcdCMgbmV3X2RhdGUgPSBuZXdfZGF0ZS5zcGxpdCgnLycpLmpvaW4oJy0nKVxyXG5cdFx0XHRcdCMgY29uc29sZS5sb2cgJ25ldyBkYXRlIGlzICcsIG5ld19kYXRlLCAnIGFuZCBpbnB1dCBpcyAnLCBpbnB1dFxyXG5cdFx0XHRcdCMgaW5wdXQudmFsKG5ld19kYXRlKVxyXG5cdFx0XHRvblNob3c6IChwYXJhbXMpIC0+XHJcblx0XHRcdFx0IyBjb25zb2xlLmxvZyBhcmd1bWVudHNcclxuXHRcdH0pXHJcblx0XHR0YWJsZS5maW5kKCcjc2F2ZS1uZXctZmluYW5jZScpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdFx0XHQkZm9ybSA9ICQodGhpcykuY2xvc2VzdCgnLm5ldy1maW5hbmNlLWZvcm0nKVxyXG5cdFx0XHR0aW1lID0gJGZvcm0uZmluZCgnI25ldy1maW5hbmNlLXRpbWUnKS52YWwoKVxyXG5cdFx0XHRjb3N0ID0gJGZvcm0uZmluZCgnI25ldy1maW5hbmNlLWNvc3QnKS52YWwoKVxyXG5cdFx0XHR0eXBlID0gJGZvcm0uZmluZCgnI25ldy1maW5hbmNlLXR5cGUnKS52YWwoKVxyXG5cdFx0XHRjb25zb2xlLmxvZyAnc2hvdyBkYXRhOicsIHRpbWUsIGNvc3QsIHR5cGVcclxuXHRcdFx0aWYgdGltZSA9PSAnJyBvciBjb3N0ID09ICcnIG9yIHR5cGUgPT0gJydcclxuXHRcdFx0XHRhbGVydCgn6K+35aGr5YaZ5a6M5pW055qE5raI6LS56K6w5b2V77yBJylcclxuXHRcdFx0aWYgaXNOYU4oY29zdClcclxuXHRcdFx0XHRhbGVydCgn6K+35aGr5YaZ5ZCI5rOV55qE6YeR6aKdJylcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdHNlbmRfZGF0YSA9IFxyXG5cdFx0XHRcdFx0ZGF0ZTogdGltZVxyXG5cdFx0XHRcdFx0bnVtYmVyOiBjb3N0XHJcblx0XHRcdFx0XHR0YWdfYXJyOiB0eXBlXHJcblx0XHRcdFx0XHR0eXBlX2lkOiAwXHJcblx0XHRcdFx0JC5hamF4KHtcclxuXHRcdFx0XHRcdHR5cGU6ICdQT1NUJ1xyXG5cdFx0XHRcdFx0dXJsOiAnL2FkZCdcclxuXHRcdFx0XHRcdGRhdGE6IHNlbmRfZGF0YVxyXG5cdFx0XHRcdFx0c3VjY2VzczogKGRhdGEpIC0+XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nICdzdWNjZXNzOicsIGRhdGEgXHJcblx0XHRcdFx0XHRcdGlmIGRhdGEucmV0X2NvZGUgPT0gJzIwMCdcclxuXHRcdFx0XHRcdFx0XHRhbGVydCAn5re75Yqg5oiQ5YqfJ1xyXG5cdFx0XHRcdFx0XHRlbHNlIFxyXG5cdFx0XHRcdFx0XHRcdGFsZXJ0ICfmm7TmlrDlpLHotKUnXHJcblx0XHRcdFx0XHRcdGxvY2F0aW9uLnJlbG9hZCgpXHJcblx0XHRcdFx0XHRlcnJvcjogKGRhdGEpIC0+XHJcblx0XHRcdFx0XHRcdGFsZXJ0ICfmt7vliqDlpLHotKUnXHJcblx0XHRcdFx0XHRcdGxvY2F0aW9uLnJlbG9hZCgpXHJcblx0XHRcdFx0XHRcdCMgY29uc29sZS5sb2cgJ2Vycm9yOicsIGRhdGFcclxuXHRcdFx0XHRcdH0pXHJcblx0XHQjIOS/ruaUueaMiemSrueCueWHu+S6i+S7tuebkeWQrFxyXG5cdFx0dGFibGUuZmluZCgnI2VkaXQtZmxpc3QnKS5vbiAnY2xpY2snLCAoZSkgLT5cclxuXHRcdFx0Y29uc29sZS5sb2cgJ2VkaXQtZmxpc3QgY2xpY2shJ1xyXG5cdFx0XHRpZiAkKHRoaXMpLmF0dHIoJ3ZhbHVlJykgPT0gJ1NhdmUnXHJcblx0XHRcdFx0IyBjaGFuZ2UgdG8gZWRpdCB2aWV3XHJcblx0XHRcdFx0IyBjcmVhdGUgZGF0ZXRpbWVwaWNrZXJcclxuXHRcdFx0XHQkKHRoaXMpLnRleHQoJ1NhdmUnKVxyXG5cdFx0XHRcdCQodGhpcykuYXR0cigndmFsdWUnLCAnRWRpdCcpXHJcblx0XHRcdFx0IyDml7bpl7TpgInmi6nlmajnm5HlkKzkuovku7ZcclxuXHRcdFx0XHQkKCcudGltZS1pdGVtJykuZGF0ZXRpbWVwaWNrZXIoe1xyXG5cdFx0XHRcdFx0bGFuZzogJ2NoJ1xyXG5cdFx0XHRcdFx0Zm9ybWF0OiAnWVlZWS1tbS1kZCdcclxuXHRcdFx0XHRcdHRpbWVwaWNrZXI6IGZhbHNlXHJcblx0XHRcdFx0XHRvbkNoYW5nZURhdGVUaW1lOiAocGFyYW1zLCBpbnB1dCwgZXZlbnQpIC0+XHJcblx0XHRcdFx0XHRcdCMg5ZCE56eN5pe26Ze05qC85byPXHJcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nIGFyZ3VtZW50cywgcGFyYW1zLmdldFVUQ0RhdGUoKSwgcGFyYW1zLnRvRGF0ZVN0cmluZygpLCBwYXJhbXMudG9Mb2NhbGVEYXRlU3RyaW5nKCksIHBhcmFtcy50b0xvY2FsZVN0cmluZygpLCBwYXJhbXMudG9VVENTdHJpbmcoKVxyXG5cdFx0XHRcdFx0XHQjIOebruWJjeeUqOeahOaYryB0b0xvY2FsZURhdGVTdHJpbmdcclxuXHRcdFx0XHRcdFx0IyAkKHRoaXMpLnRleHQocGFyYW1zLnRvTG9jYWxlRGF0ZVN0cmluZygpKVxyXG5cdFx0XHRcdFx0XHRuZXdfZGF0ZSA9IHBhcmFtcy50b0xvY2FsZURhdGVTdHJpbmcoKVxyXG5cdFx0XHRcdFx0XHRuZXdfZGF0ZSA9IG5ld19kYXRlLnNwbGl0KCcvJykuam9pbignLScpXHJcblx0XHRcdFx0XHRcdGlucHV0LnRleHQobmV3X2RhdGUpXHJcblxyXG5cdFx0XHRcdFx0b25TaG93OiAocGFyYW1zKSAtPlxyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyBhcmd1bWVudHNcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0Y29zdElucHV0ID0gKGUpIC0+XHJcblx0XHRcdFx0XHRpZiAkKHRoaXMpLmZpbmQoJ2lucHV0JykubGVuZ3RoID09IDBcclxuXHRcdFx0XHRcdFx0b2xkID0gJCh0aGlzKS50ZXh0KClcclxuXHRcdFx0XHRcdFx0JCh0aGlzKS5hdHRyKCd2YWwnLCBvbGQpXHJcblx0XHRcdFx0XHRcdGlucHV0X2h0bWwgPSBcIlwiXCI8aW5wdXQgY2xhc3M9XCJ1aSBpbnZlcnRlZCBpbnB1dFwiIHR5cGU9XCJ0ZXh0XCIgdmFsdWU9XCIje29sZH1cIi8+XCJcIlwiXHJcblx0XHRcdFx0XHRcdCQodGhpcykuaHRtbChpbnB1dF9odG1sKVxyXG5cdFx0XHRcdCQoJy5jb3N0LWl0ZW0nKS5vbiAnY2xpY2snLCBjb3N0SW5wdXRcclxuXHRcdFx0XHR0eXBlSW5wdXQgPSAoZSkgLT5cclxuXHRcdFx0XHRcdGlmICQodGhpcykuZmluZCgnaW5wdXQnKS5sZW5ndGggPT0gMFxyXG5cdFx0XHRcdFx0XHRvbGQgPSAkKHRoaXMpLnRleHQoKVxyXG5cdFx0XHRcdFx0XHQkKHRoaXMpLmF0dHIoJ3ZhbCcsIG9sZClcclxuXHRcdFx0XHRcdFx0aW5wdXRfaHRtbCA9IFwiXCJcIjxpbnB1dCBjbGFzcz1cInVpIGludmVydGVkIGlucHV0XCIgdHlwZT1cInRleHRcIiB2YWx1ZT1cIiN7b2xkfVwiLz5cIlwiXCJcclxuXHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKGlucHV0X2h0bWwpXHJcblx0XHRcdFx0JCgnLnR5cGUtaXRlbScpLm9uICdjbGljaycsIHR5cGVJbnB1dFx0XHJcblx0XHRcdFx0IyDmmL7npLrliKDpmaTnmoTpgInpoblcclxuXHRcdFx0XHQkKCcub3BlcmF0ZS1pdGVtLWhlYWQnKS5yZW1vdmVDbGFzcygnZGlzcGxheS1ub25lJylcclxuXHRcdFx0XHQkKCcub3BlcmF0ZS1pdGVtJykucmVtb3ZlQ2xhc3MoJ2Rpc3BsYXktbm9uZScpXHJcblx0XHRcdCMg5L+d5a2Y5L+u5pS55ZCO55qE5pWw5o2uXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHQjIOWPlua2iOaXtumXtOmAieaLqeWZqFxyXG5cdFx0XHRcdCQoJy50aW1lLWl0ZW0nKS5kYXRldGltZXBpY2tlcignZGVzdHJveScpXHJcblx0XHRcdFx0JC5lYWNoICQoJy5jb3N0LWl0ZW0nKSwgKGksIGUpIC0+XHJcblx0XHRcdFx0XHQkaW5wdXQgPSAkKHRoaXMpLmZpbmQoJ2lucHV0JylcclxuXHRcdFx0XHRcdGlmICRpbnB1dC5sZW5ndGggIT0gMFxyXG5cdFx0XHRcdFx0XHQjIG5ld192YWwgPSAkKHRoaXMpLmF0dHIoJ3ZhbCcpXHJcblx0XHRcdFx0XHRcdG5ld192YWwgPSAkaW5wdXQudmFsKClcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgJCh0aGlzKSwgJCh0aGlzKS5hdHRyKCd2YWwnKSwgbmV3X3ZhbFxyXG5cdFx0XHRcdFx0XHRyZWcgPSAvXlthLXpBLVowLTlcXHU0ZTAwLVxcdTlmYTUgXSskL1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgcmVnLnRlc3QobmV3X3ZhbCkgPT0gdHJ1ZVxyXG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nICd0cnVlIHdoaWxlIHRlc3QgdGhlIHJlZzonLCBuZXdfdmFsXHJcblx0XHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKG5ld192YWwpXHJcblx0XHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZyBuZXdfdmFsLCAnIGlzIGZhbHNlIHdoaWxlIHRlc3QgdGhlIHJlZydcclxuXHRcdFx0XHRcdFx0XHQkKHRoaXMpLmh0bWwoJCh0aGlzKS5hdHRyKCd2YWwnKSlcclxuXHRcdFx0XHQkLmVhY2ggJCgnLnR5cGUtaXRlbScpLCAoaSwgZSkgLT5cclxuXHRcdFx0XHRcdCRpbnB1dCA9ICQodGhpcykuZmluZCgnaW5wdXQnKVxyXG5cdFx0XHRcdFx0aWYgJGlucHV0Lmxlbmd0aCAhPSAwXHJcblx0XHRcdFx0XHRcdG5ld192YWwgPSAkaW5wdXQudmFsKClcclxuXHRcdFx0XHRcdFx0aWYgbmV3X3ZhbCAhPSAnJ1xyXG5cdFx0XHRcdFx0XHRcdCQodGhpcykuaHRtbChuZXdfdmFsKVxyXG5cdFx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKCQodGhpcykuYXR0cigndmFsJykpXHJcblx0XHRcdFx0IyBjaGFuZ2UgdG8gc2F2ZSB2aWV3XHJcblx0XHRcdFx0IyByZXF1ZXN0IHRvIHVwYXRlIGRhdGFcclxuXHRcdFx0XHRjb25zb2xlLmxvZyAnZGVmYXVsdHM6JywgY29udGV4dC5kZWZhdWx0c1xyXG5cdFx0XHRcdCMg5pu05paw5bey5L+u5pS555qE5pWw5o2u77yM54S25ZCO6Kem5Y+RZmxpc3TnmoRkYXRhY2hhbmdlOlxyXG5cdFx0XHRcdCRmX2xpc3QgPSBjb250ZXh0LmRlZmF1bHRzLmNvbnRhaW5lci5maW5kKCd0Ym9keSB0cicpXHJcblx0XHRcdFx0Zl9saXN0X2RhdGEgPSBbXVxyXG5cdFx0XHRcdCQuZWFjaCAkZl9saXN0LCAoaSwgZSkgLT5cclxuXHRcdFx0XHRcdHRpbWUgPSAkZl9saXN0LmVxKGkpLmZpbmQoJy50aW1lLWl0ZW0nKS50ZXh0KClcclxuXHRcdFx0XHRcdGNvc3QgPSAkZl9saXN0LmVxKGkpLmZpbmQoJy5jb3N0LWl0ZW0nKS50ZXh0KClcclxuXHRcdFx0XHRcdHR5cGUgPSAkZl9saXN0LmVxKGkpLmZpbmQoJy50eXBlLWl0ZW0nKS50ZXh0KClcclxuXHRcdFx0XHRcdGlkID0gJGZfbGlzdC5lcShpKS5hdHRyKCdhbHQnKVxyXG5cdFx0XHRcdFx0Zl9saXN0X2RhdGEucHVzaCB7XHJcblx0XHRcdFx0XHRcdGlkOiBpZFxyXG5cdFx0XHRcdFx0XHRkYXRlIDogdGltZVxyXG5cdFx0XHRcdFx0XHRudW1iZXIgOiBjb3N0IFxyXG5cdFx0XHRcdFx0XHR0YWdfYXJyIDogdHlwZVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnRleHQuZGVmYXVsdHMuZGF0YXMgPSBmX2xpc3RfZGF0YVxyXG5cdFx0XHRcdGNvbnRleHQuZGVmYXVsdHMuZmxpc3QuZW1pdCAnRkxpc3Q6ZGF0YUNoYW5nZScsIGNvbnRleHQuZGVmYXVsdHMuZGF0YXNcclxuXHRcdFx0XHQjIOWPlua2iOe7keWumlxyXG5cdFx0XHRcdCQoJy5jb3N0LWl0ZW0nKS51bmJpbmQoJ2NsaWNrJylcclxuXHRcdFx0XHQkKCcudHlwZS1pdGVtJykudW5iaW5kKCdjbGljaycpXHJcblx0XHRcdFx0IyDpmpDol4/liKDpmaTpgInpoblcclxuXHRcdFx0XHQkKCcub3BlcmF0ZS1pdGVtLWhlYWQnKS5hZGRDbGFzcygnZGlzcGxheS1ub25lJylcclxuXHRcdFx0XHQkKCcub3BlcmF0ZS1pdGVtJykuYWRkQ2xhc3MoJ2Rpc3BsYXktbm9uZScpXHJcblx0XHQjIOa3u+WKoOaMiemSrueCueWHu+S6i+S7tuebkeWQrFxyXG5cdFx0dGFibGUuZmluZCgnI2FkZC1mbGlzdCcpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdFx0XHRjb25zb2xlLmxvZyAndG8gYWRkIG5ldyBmaW5hbmNlJ1xyXG5cdFx0XHRjb250ZXh0LmRlZmF1bHRzLmNvbnRhaW5lci5maW5kKCcubmV3LWZpbmFuY2UtZm9ybScpLnNob3coKVxyXG5cdFx0IyDliKDpmaTmjInpkq7ngrnlh7vkuovku7bnm5HlkKxcclxuXHRcdHRhYmxlLmZpbmQoJ3Rib2R5Jykub24gJ2NsaWNrJywgJy5vcGVyYXRlLWl0ZW0nLCAoZSkgLT5cclxuXHRcdFx0dGhhdCA9ICQodGhpcykuY2xvc2VzdCgndHInKVxyXG5cdFx0XHRmaW5hbmNlX2lkID0gdGhhdC5hdHRyKCdhbHQnKVxyXG5cdFx0XHRzZW5kX2RhdGEgPSBcclxuXHRcdFx0XHRmaW5hbmNlX2lkOiBmaW5hbmNlX2lkXHJcblx0XHRcdCQuYWpheCh7XHJcblx0XHRcdFx0dHlwZTogJ1BPU1QnXHJcblx0XHRcdFx0dXJsOiAnL2RlbCdcclxuXHRcdFx0XHRkYXRhOiBzZW5kX2RhdGFcclxuXHRcdFx0XHRzdWNjZXNzOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRcdGlmIGRhdGEucmV0X2NvZGUgPT0gJzIwMCdcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgJ2RlbGV0ZSBvayEnXHJcblx0XHRcdFx0XHRcdHRoYXQucmVtb3ZlKClcclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgJ2RlbGV0ZSBmYWlsJ1xyXG5cdFx0XHRcdGVycm9yOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRcdGNvbnNvbGUubG9nICdkZWxldGUgZmFpbCdcclxuXHRcdFx0fSlcclxuXHJcblx0Z2V0VmFsOiAob2JqLCBkZWZhdWx0cykgLT5cclxuXHRcdHJldHVybiBpZiBvYmo/IHRoZW4gb2JqIGVsc2UgZGVmYXVsdHNcclxuXHJcblx0cmVuZGVyOiAoZGF0YXMpIC0+XHJcblx0XHRjb250ZXh0ID0gQFxyXG5cdFx0QGRlZmF1bHRzLmRhdGFzID0gZGF0YXNcclxuXHRcdGNvbnNvbGUubG9nIGRhdGFzXHJcblx0XHRpdGVtc19odG1sID0gJydcclxuXHRcdCQuZWFjaCBkYXRhcy5mbGlzdCwgKGksIGUpIC0+XHJcblx0XHRcdGRhdGVfID0gZS5kYXRlLnNsaWNlKDAsIDEwKVxyXG5cdFx0XHRjb3N0XyA9IGUubnVtYmVyXHJcblx0XHRcdHR5cGVfID0gZS50YWdfYXJyLmpvaW4oJyAnKVxyXG5cdFx0XHRpZF8gPSBlLmlkXHJcblx0XHRcdGl0ZW1faHRtbCA9IFwiXCJcIlxyXG5cdFx0XHRcdDx0ciBhbHQ9XCIje2lkX31cIj5cclxuXHRcdFx0XHRcdDx0ZCBjbGFzcz1cInRpbWUtaXRlbVwiPiN7ZGF0ZV99PC90ZD5cclxuXHRcdFx0XHRcdDx0ZCBjbGFzcz1cImNvc3QtaXRlbVwiPiN7Y29zdF99PC90ZD5cclxuXHRcdFx0XHRcdDx0ZCBjbGFzcz1cInR5cGUtaXRlbVwiPiN7dHlwZV99PC90ZD5cclxuXHRcdFx0XHRcdDx0ZCBjbGFzcz1cIm9wZXJhdGUtaXRlbSBkaXNwbGF5LW5vbmVcIj5kZWxldGU8L3RkPlxyXG5cdFx0XHRcdDwvdHI+XHJcblx0XHRcdFwiXCJcIlxyXG5cdFx0XHRpdGVtc19odG1sICs9IGl0ZW1faHRtbFxyXG5cdFx0QGRlZmF1bHRzLnRhYmxlLmZpbmQoJ3Rib2R5JykuaHRtbChpdGVtc19odG1sKVxyXG5cclxuIyDlr7nmlLblhaXmlK/lh7rlgZrnu5/orqHvvIzlj6/op4bljJZcclxuY2xhc3MgQ29zdENoYXJ0U2hvdyBleHRlbmRzIEV2ZW50RW1pdHRlclxyXG5cdGNvbnN0cnVjdG9yOiAob3B0aW9ucykgLT5cclxuXHRcdEBkZWZhdWx0cyA9IFxyXG5cdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdFx0XHJcblx0XHRAaW5pdCgpXHJcblx0aW5pdDogKCkgLT5cclxuXHRcdGNoYXJ0X2h0bWwgPSBcIlwiXCJcclxuXHRcdFx0PGRpdiBpZD1cImNvc3QtY2hhcnQtY29udGFpbmVyXCIgY2xhc3M9XCJjaGFydF9jb250YWluZXJcIiBzdHlsZT1cIndpZHRoOiA2MDBweDsgaGVpZ2h0OiA0MDBweDtcIj48L2Rpdj5cclxuXHRcdFwiXCJcIlxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5oaWRlKClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaHRtbChjaGFydF9odG1sKVxyXG5cdFx0aWYgZGF0YV9jZW50ZXIuZmxpc3QgIT0gbnVsbFxyXG5cdFx0XHRAZGVmYXVsdHMuZGF0YSA9IGRhdGFfY2VudGVyLmZsaXN0XHJcblx0XHRcdEBzaG93Q29zdENoYXJ0KClcclxuXHRzaG93Q29zdENoYXJ0OiAoKSAtPlxyXG5cdFx0aWYgZGF0YV9jZW50ZXIuZmxpc3QgPT0gbnVsbCBvciB0eXBlb2YgZGF0YV9jZW50ZXIuZmxpc3QgPT0gJ3VuZGVmaW5lZCdcclxuXHRcdFx0cmV0dXJuXHJcblx0XHRlbHNlIFxyXG5cdFx0XHRmbGlzdF8gPSBkYXRhX2NlbnRlci5mbGlzdFxyXG5cdFx0XHRjb25zb2xlLmxvZyAnZmxpc3RfOicsIGZsaXN0X1xyXG5cdFx0XHRkYXRlID0gW11cclxuXHRcdFx0ZGF0YSA9IFtdXHJcblx0XHRcdGZvciBmIGluIGZsaXN0X1xyXG5cdFx0XHRcdGRhdGUucHVzaCBmLmRhdGUuc2xpY2UoMCwgMTApXHJcblx0XHRcdFx0ZGF0YS5wdXNoIGYubnVtYmVyXHJcblx0XHRcdGNvc3RfY2hhcnQgPSBlY2hhcnRzLmluaXQoJCgnI2Nvc3QtY2hhcnQtY29udGFpbmVyJylbMF0pXHJcblxyXG5cdFx0XHQjIGJhc2UgPSAobmV3IERhdGUoMjAxNSwgOSwgNCkpLnZhbHVlT2YoKVxyXG5cdFx0XHQjIG9uZURheSA9IDI0ICogMzYwMCAqIDEwMDBcclxuXHRcdFx0IyBkYXRlID0gW11cclxuXHRcdFx0IyBkYXRhID0gW01hdGgucmFuZG9tKCkgKiAxNTBdXHJcblxyXG5cdFx0XHQjIGZvciBpIGluIFswLi4xMDBdXHJcblx0XHRcdCMgXHRub3cgID0gbmV3IERhdGUoYmFzZSArPSBvbmVEYXkpXHJcblx0XHRcdCMgXHRkYXRlLnB1c2goW25vdy5nZXRGdWxsWWVhcigpLCBub3cuZ2V0TW9udGgoKSArIDEsIG5vdy5nZXREYXRlKCldLmpvaW4oJy0nKSlcclxuXHRcdFx0IyBcdGRhdGEucHVzaCgoTWF0aC5yYW5kb20oKSAtIC40KSAqIDIwKSArIGRhdGFbaSAtIDFdO1xyXG5cdFx0XHRvcHRpb24gPSB7XHJcblx0XHRcdFx0dGl0bGU6IHtcclxuXHRcdFx0XHRcdHg6ICdjZW50ZXInLFxyXG5cdFx0XHRcdFx0dGV4dDogJ+aUtuWFpeaUr+WHuicsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRsZWdlbmQ6IHtcclxuXHRcdFx0XHRcdHRvcDogJ2JvdHRvbScsXHJcblx0XHRcdFx0XHRkYXRhOlsn5oSP5ZCRJ11cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHRvb2xib3g6IHtcclxuXHRcdFx0XHRcdHNob3c6IHRydWUsXHJcblx0XHRcdFx0XHRmZWF0dXJlOiB7XHJcblx0XHRcdFx0XHRcdG1hcms6IHtzaG93OiB0cnVlfSxcclxuXHRcdFx0XHRcdFx0ZGF0YVZpZXc6IHtzaG93OiB0cnVlLCByZWFkT25seTogZmFsc2V9LFxyXG5cdFx0XHRcdFx0XHRtYWdpY1R5cGU6IHtzaG93OiB0cnVlLCB0eXBlOiBbJ2xpbmUnLCAnYmFyJywgJ3N0YWNrJywgJ3RpbGVkJ119LFxyXG5cdFx0XHRcdFx0XHRyZXN0b3JlOiB7c2hvdzogdHJ1ZX0sXHJcblx0XHRcdFx0XHRcdHNhdmVBc0ltYWdlOiB7c2hvdzogdHJ1ZX1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHhBeGlzOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHR5cGU6ICdjYXRlZ29yeScsXHJcblx0XHRcdFx0XHRcdGJvdW5kYXJ5R2FwOiBmYWxzZSxcclxuXHRcdFx0XHRcdFx0ZGF0YTogZGF0ZVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdFx0eUF4aXM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ3ZhbHVlJyxcclxuXHRcdFx0XHRcdFx0IyBtYXg6IDUwMFxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdFx0ZGF0YVpvb206IHtcclxuXHRcdFx0XHRcdHR5cGU6ICdpbnNpZGUnLFxyXG5cdFx0XHRcdFx0c3RhcnQ6IDYwLFxyXG5cdFx0XHRcdFx0ZW5kOiA4MFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0c2VyaWVzOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6J+aIkOS6pCcsXHJcblx0XHRcdFx0XHRcdHR5cGU6J2xpbmUnLFxyXG5cdFx0XHRcdFx0XHRzbW9vdGg6dHJ1ZSxcclxuXHRcdFx0XHRcdFx0c3ltYm9sOiAnbm9uZScsXHJcblx0XHRcdFx0XHRcdHN0YWNrOiAnYScsXHJcblx0XHRcdFx0XHRcdGFyZWFTdHlsZToge1xyXG5cdFx0XHRcdFx0XHRcdG5vcm1hbDoge31cclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0ZGF0YTogZGF0YVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdF1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29zdF9jaGFydC5zZXRPcHRpb24ob3B0aW9uKVxyXG5cdFxyXG5cdCMjIypcclxuXHQgKiDov5Tlm55vYmrnmoTlgLzvvIzkuI3lrZjlnKjliJnov5Tlm55kZWZhdWx0c1xyXG5cdCMjI1xyXG5cdGdldFZhbDogKG9iaiwgZGVmYXVsdHMpIC0+XHJcblx0XHRyZXR1cm4gaWYgb2JqPyB0aGVuIG9iaiBlbHNlIGRlZmF1bHRzXHJcblx0XHJcblx0c2hvdzogKCkgLT5cclxuXHRcdEBzaG93Q29zdENoYXJ0KClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuc2hvdygpXHJcblxyXG5cdGhpZGU6ICgpIC0+XHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmhpZGUoKVxyXG5cclxuIyDlr7nmtojotLnojIPlm7TlgZrnu5/orqHvvIzlj6/op4bljJZcclxuY2xhc3MgUmFuZ2VDaGFydFNob3cgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcclxuXHRjb25zdHJ1Y3RvcjogKG9wdGlvbnMpIC0+XHJcblx0XHRAZGVmYXVsdHMgPSBcclxuXHRcdFx0Y29udGFpbmVyOiBAZ2V0VmFsKG9wdGlvbnMuY29udGFpbmVyLCAkKCdib2R5JykpXHJcblx0XHRAaW5pdCgpXHJcblx0aW5pdDogKCkgLT5cclxuXHRcdGNoYXJ0X2h0bWwgPSBcIlwiXCJcclxuXHRcdFx0PGRpdiBpZD1cInJhbmdlLWNoYXJ0LWNvbnRhaW5lclwiIGNsYXNzPVwiY2hhcnRfY29udGFpbmVyXCIgc3R5bGU9XCJ3aWR0aDogNjAwcHg7IGhlaWdodDogNDAwcHg7XCI+PC9kaXY+XHJcblx0XHRcIlwiXCJcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaGlkZSgpXHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmh0bWwoY2hhcnRfaHRtbClcclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ICE9IG51bGxcclxuXHRcdFx0QGRlZmF1bHRzLmRhdGEgPSBkYXRhX2NlbnRlci5mbGlzdFxyXG5cdFx0XHRAc2hvd1JhbmdlQ2hhcnQoKVxyXG5cclxuXHR1cGRhdGU6ICgpIC0+XHJcblx0XHRpZiBkYXRhX2NlbnRlci5mbGlzdCAhPSBudWxsXHJcblx0XHRcdEBkZWZhdWx0cy5kYXRhID0gZGF0YV9jZW50ZXIuZmxpc3RcclxuXHRcdFx0QHNob3dSYW5nZUNoYXJ0KClcclxuXHJcblx0c2hvd1JhbmdlQ2hhcnQ6ICgpIC0+XHJcblx0XHRpZiBkYXRhX2NlbnRlci5mbGlzdCA9PSBudWxsIG9yIHR5cGVvZiBkYXRhX2NlbnRlci5mbGlzdCA9PSAndW5kZWZpbmVkJ1xyXG5cdFx0XHRyZXR1cm5cclxuXHRcdGVsc2UgXHJcblx0XHRcdHRhZ19tYXAgPSB7fVxyXG5cdFx0XHRmb3IgZiBpbiBkYXRhX2NlbnRlci5mbGlzdFxyXG5cdFx0XHRcdHRhZ19hcnIgPSBmLnRhZ19hcnJcclxuXHRcdFx0XHRmb3IgdCBpbiB0YWdfYXJyXHJcblx0XHRcdFx0XHRpZiB0YWdfbWFwW3RdP1xyXG5cdFx0XHRcdFx0XHR0YWdfbWFwW3RdKytcclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0dGFnX21hcFt0XSA9IDBcclxuXHRcdFx0Y29uc29sZS5sb2cgJ3RhZ19tYXA6JywgdGFnX21hcFxyXG5cclxuXHRcdFx0Y29zdF9jaGFydCA9IGVjaGFydHMuaW5pdCgkKCcjcmFuZ2UtY2hhcnQtY29udGFpbmVyJylbMF0pXHJcblx0XHRcdG9wdGlvbiA9IHtcclxuXHRcdFx0ICAgIGJhY2tncm91bmRDb2xvcjogJyMyYzM0M2MnLFxyXG5cclxuXHRcdFx0ICAgIHRpdGxlOiB7XHJcblx0XHRcdCAgICAgICAgdGV4dDogJ0N1c3RvbWl6ZWQgUGllJyxcclxuXHRcdFx0ICAgICAgICBsZWZ0OiAnY2VudGVyJyxcclxuXHRcdFx0ICAgICAgICB0b3A6IDIwLFxyXG5cdFx0XHQgICAgICAgIHRleHRTdHlsZToge1xyXG5cdFx0XHQgICAgICAgICAgICBjb2xvcjogJyNjY2MnXHJcblx0XHRcdCAgICAgICAgfVxyXG5cdFx0XHQgICAgfSxcclxuXHJcblx0XHRcdCAgICB0b29sdGlwIDoge1xyXG5cdFx0XHQgICAgICAgIHRyaWdnZXI6ICdpdGVtJyxcclxuXHRcdFx0ICAgICAgICBmb3JtYXR0ZXI6IFwie2F9IDxici8+e2J9IDoge2N9ICh7ZH0lKVwiXHJcblx0XHRcdCAgICB9LFxyXG5cclxuXHRcdFx0ICAgIHZpc3VhbE1hcDoge1xyXG5cdFx0XHQgICAgICAgIHNob3c6IGZhbHNlLFxyXG5cdFx0XHQgICAgICAgIG1pbjogODAsXHJcblx0XHRcdCAgICAgICAgbWF4OiA2MDAsXHJcblx0XHRcdCAgICAgICAgaW5SYW5nZToge1xyXG5cdFx0XHQgICAgICAgICAgICBjb2xvckxpZ2h0bmVzczogWzAsIDFdXHJcblx0XHRcdCAgICAgICAgfVxyXG5cdFx0XHQgICAgfSxcclxuXHRcdFx0ICAgIHNlcmllcyA6IFtcclxuXHRcdFx0ICAgICAgICB7XHJcblx0XHRcdCAgICAgICAgICAgIG5hbWU6J+iuv+mXruadpea6kCcsXHJcblx0XHRcdCAgICAgICAgICAgIHR5cGU6J3BpZScsXHJcblx0XHRcdCAgICAgICAgICAgIHJhZGl1cyA6ICc1NSUnLFxyXG5cdFx0XHQgICAgICAgICAgICBjZW50ZXI6IFsnNTAlJywgJzUwJSddLFxyXG5cdFx0XHQgICAgICAgICAgICBkYXRhOltcclxuXHRcdFx0ICAgICAgICAgICAgICAgIHt2YWx1ZTozMzUsIG5hbWU6J+ebtOaOpeiuv+mXrid9LFxyXG5cdFx0XHQgICAgICAgICAgICAgICAge3ZhbHVlOjMxMCwgbmFtZTon6YKu5Lu26JCl6ZSAJ30sXHJcblx0XHRcdCAgICAgICAgICAgICAgICB7dmFsdWU6Mjc0LCBuYW1lOifogZTnm5/lub/lkYonfSxcclxuXHRcdFx0ICAgICAgICAgICAgICAgIHt2YWx1ZToyMzUsIG5hbWU6J+inhumikeW5v+WRiid9LFxyXG5cdFx0XHQgICAgICAgICAgICAgICAge3ZhbHVlOjQwMCwgbmFtZTon5pCc57Si5byV5pOOJ31cclxuXHRcdFx0ICAgICAgICAgICAgXS5zb3J0KCAoYSwgYiktPiAgcmV0dXJuIGEudmFsdWUgLSBiLnZhbHVlKSxcclxuXHRcdFx0ICAgICAgICAgICAgcm9zZVR5cGU6ICdhbmdsZScsXHJcblx0XHRcdCAgICAgICAgICAgIGxhYmVsOiB7XHJcblx0XHRcdCAgICAgICAgICAgICAgICBub3JtYWw6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICB0ZXh0U3R5bGU6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6ICdyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMyknXHJcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgfVxyXG5cdFx0XHQgICAgICAgICAgICAgICAgfVxyXG5cdFx0XHQgICAgICAgICAgICB9LFxyXG5cdFx0XHQgICAgICAgICAgICBsYWJlbExpbmU6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgIG5vcm1hbDoge1xyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIGxpbmVTdHlsZToge1xyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogJ3JnYmEoMjU1LCAyNTUsIDI1NSwgMC4zKSdcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICB9LFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIHNtb290aDogMC4yLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIGxlbmd0aDogMTAsXHJcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgbGVuZ3RoMjogMjBcclxuXHRcdFx0ICAgICAgICAgICAgICAgIH1cclxuXHRcdFx0ICAgICAgICAgICAgfSxcclxuXHRcdFx0ICAgICAgICAgICAgaXRlbVN0eWxlOiB7XHJcblx0XHRcdCAgICAgICAgICAgICAgICBub3JtYWw6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICBjb2xvcjogJyNjMjM1MzEnLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIHNoYWRvd0JsdXI6IDIwMCxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICBzaGFkb3dDb2xvcjogJ3JnYmEoMCwgMCwgMCwgMC41KSdcclxuXHRcdFx0ICAgICAgICAgICAgICAgIH1cclxuXHRcdFx0ICAgICAgICAgICAgfVxyXG5cdFx0XHQgICAgICAgIH1cclxuXHRcdFx0ICAgIF1cclxuXHRcdFx0fTtcclxuXHRcdFx0Y29zdF9jaGFydC5zZXRPcHRpb24ob3B0aW9uKVxyXG5cclxuXHQjIyMqXHJcblx0ICog6L+U5Zueb2Jq55qE5YC877yM5LiN5a2Y5Zyo5YiZ6L+U5ZueZGVmYXVsdHNcclxuXHQjIyNcclxuXHRnZXRWYWw6IChvYmosIGRlZmF1bHRzKSAtPlxyXG5cdFx0cmV0dXJuIGlmIG9iaj8gdGhlbiBvYmogZWxzZSBkZWZhdWx0c1xyXG5cdHNob3c6ICgpIC0+XHJcblx0XHRAdXBkYXRlKClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuc2hvdygpXHJcblxyXG5cdGhpZGU6ICgpIC0+XHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmhpZGUoKVxyXG5cclxub3B0aW9ucyA9IFxyXG5cdG5hbWU6ICdjanMnXHJcblx0Y29udGFpbmVyOiAkKCcudWkuZ3JpZC5maW5hbmNlIC5vbGl2ZS50d2VsdmUud2lkZS5jb2x1bW4gLmZpbmFuY2UtdGFibGUnKVxyXG5cdGV2ZW50YnVzOiBldmVudGJ1c1xyXG5cclxuX2ZsaXN0ID0gbmV3IEZsaXN0KG9wdGlvbnMpXHJcblxyXG5cclxuY29zdF9vcHRpb25zID0gXHJcblx0Y29udGFpbmVyOiAkKCcudWkuZ3JpZC5maW5hbmNlIC5vbGl2ZS50d2VsdmUud2lkZS5jb2x1bW4gLmNvc3QtY2hhcnQnKVxyXG5fY29zdCA9IG5ldyBDb3N0Q2hhcnRTaG93KGNvc3Rfb3B0aW9ucylcclxuXHJcbnJhbmdlX29wdGlvbnMgPSBcclxuXHRjb250YWluZXI6ICQoJy51aS5ncmlkLmZpbmFuY2UgLm9saXZlLnR3ZWx2ZS53aWRlLmNvbHVtbiAucmFuZ2UtY2hhcnQnKVxyXG5fcmFuZ2UgPSBuZXcgUmFuZ2VDaGFydFNob3cocmFuZ2Vfb3B0aW9ucylcclxuXHJcblxyXG4jIOi+ueagj+S6i+S7tuebkeWQrFxyXG4jIOaYvuekuua2iOi0ueWIl+ihqFxyXG4kKCcjZmluYW5jZS1saXN0Jykub24gJ2NsaWNrJywgKGUpIC0+XHJcblx0Y29uc29sZS5sb2cgJ3RvIHNob3cgZmluYW5jZS1saXN0J1x0XHJcblx0X2ZsaXN0LnNob3coKVxyXG5cdF9jb3N0LmhpZGUoKVxyXG5cdF9yYW5nZS5oaWRlKClcclxuJCgnI2ZpbmFuY2UtY29zdCcpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdGNvbnNvbGUubG9nICd0byBzaG93IGNvc3QgYXJlYSdcclxuXHRfZmxpc3QuaGlkZSgpXHJcblx0X2Nvc3Quc2hvdygpXHJcblx0X3JhbmdlLmhpZGUoKVxyXG5cclxuJCgnI2ZpbmFuY2UtdHlwZScpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdGNvbnNvbGUubG9nICd0byBzaG93IHR5cGUnXHJcblx0X2ZsaXN0LmhpZGUoKVxyXG5cdF9jb3N0LmhpZGUoKVxyXG5cdF9yYW5nZS5zaG93KCkiXX0=
