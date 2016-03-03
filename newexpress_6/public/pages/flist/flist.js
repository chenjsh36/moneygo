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
var CostChartShow, EventEmitter, FListTable, Flist, RangeChartShow, WordCloud, _cost, _flist, _range, _word_cloud, cost_options, data_center, eventbus, options, range_options, word_options,
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
    var c, cal_data, cost_chart, data, date, date_, f, flist_, j, len, option;
    if (data_center.flist === null || typeof data_center.flist === 'undefined') {

    } else {
      flist_ = data_center.flist;
      console.log('flist_:', flist_);
      date = [];
      data = [];
      cal_data = {};
      for (j = 0, len = flist_.length; j < len; j++) {
        f = flist_[j];
        date_ = f.date.slice(0, 10);
        if (cal_data[date_] != null) {
          cal_data[date_] += f.number;
        } else {
          cal_data[date_] = f.number;
        }
      }
      for (c in cal_data) {
        date.push(c);
        data.push(cal_data[c]);
      }
      cost_chart = echarts.init($('#cost-chart-container')[0]);
      option = {
        title: {
          x: 'center',
          text: '收入支出'
        },
        toolbox: {
          show: false,
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
    var cost_chart, data, f, j, k, len, len1, option, ref, t, tag_arr, tag_map;
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
            tag_map[t] = 1;
          }
        }
      }
      console.log('tag_map:', tag_map);
      data = [];
      for (t in tag_map) {
        data.push({
          name: t,
          value: tag_map[t]
        });
      }
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
            colorLightness: [0.2, 1]
          }
        },
        series: [
          {
            name: '消费领域',
            type: 'pie',
            radius: '55%',
            center: ['50%', '50%'],
            data: data.sort(function(a, b) {
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

WordCloud = (function(superClass) {
  extend(WordCloud, superClass);

  function WordCloud(options) {
    this.defaults = {
      container: this.getVal(options.container, $('body'))
    };
    this.init();
  }

  WordCloud.prototype.init = function() {
    var d3_html;
    d3_html = "<div id=\"word-cloud-container\" class=\"chart_container\" style=\"width: 1200px; height: 800px;\"></div>";
    this.defaults.container.hide();
    this.defaults.container.html(d3_html);
    if (data_center.flist !== null) {
      this.defaults.data = data_center.flist;
      return this.showWordCloud();
    }
  };

  WordCloud.prototype.update = function() {
    if (data_center.flist !== null) {
      this.defaults.data = data_center.flist;
      return this.showWordCloud();
    }
  };

  WordCloud.prototype.showWordCloud = function() {
    var draw, font_size, rx, ry;
    if (data_center.flist === null || typeof data_center.flist === 'undefined') {
      console.log('not ok');
    } else {
      draw = function(words) {
        console.log('to draw');
        return d3.select("#word-cloud-container").append("svg").attr("width", 1200).attr("height", 800).append("g").attr("transform", "translate(500,500)").selectAll("text").data(words).enter().append("text").style("font-size", function(d) {
          return d.size + "px";
        }).attr("text-anchor", "middle").attr("transform", function(d) {
          return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
        }).text(function(d) {
          return d.text;
        });
      };
      console.log('ok');
      rx = [.1, .1, .1, .2, .9, .7, .7, .9, .9];
      ry = [.1, .1, .2, .1, .9, .7, .7, .7, .7];
      font_size = [69, 50, 109, 104, 93, 78, 76, 73, 70];
      return d3.layout.cloud().size([1000, 1000]).words(["Hello", "world", "normally", "you", "want", "more", "words", "than", "this"].map(function(d, i) {
        return {
          text: d,
          size: font_size[i],
          origin_x: rx[i],
          origin_y: ry[i]
        };
      })).rotate(function() {
        return ~~(Math.random() * 2) * 360;
      }).fontSize(function(d) {
        return d.size;
      }).on("end", draw).start();
    }
  };

  WordCloud.prototype.getVal = function(obj, defaults) {
    if (obj != null) {
      return obj;
    } else {
      return defaults;
    }
  };

  WordCloud.prototype.show = function() {
    this.defaults.container.show();
    return this.update();
  };

  WordCloud.prototype.hide = function() {
    return this.defaults.container.hide();
  };

  return WordCloud;

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

word_options = {
  container: $('.ui.grid.finance .olive.twelve.wide.column .word-cloud')
};

_word_cloud = new WordCloud(word_options);

$('#finance-list').on('click', function(e) {
  console.log('to show finance-list');
  _flist.show();
  _cost.hide();
  _range.hide();
  return _word_cloud.hide();
});

$('#finance-cost').on('click', function(e) {
  console.log('to show cost area');
  _flist.hide();
  _cost.show();
  _range.hide();
  return _word_cloud.hide();
});

$('#finance-type').on('click', function(e) {
  console.log('to show type');
  _flist.hide();
  _cost.hide();
  _range.show();
  return _word_cloud.hide();
});

$('#d3-cloud').on('click', function(e) {
  console.log('to show word-cloud');
  _flist.hide();
  _cost.hide();
  _range.hide();
  return _word_cloud.show();
});



},{"../../lib/eventemitter2/eventemitter2":1,"../../own_modules/eventbus/eventbus":2}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOi9jaGVuanNoMzYvbXlkZXZlbG9wL25vZGUvbmV3ZXhwcmVzc182L3dlYmZlL2xpYi9ldmVudGVtaXR0ZXIyL2V2ZW50ZW1pdHRlcjIuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXG93bl9tb2R1bGVzXFxldmVudGJ1c1xcZXZlbnRidXMuY29mZmVlIiwiRTpcXGNoZW5qc2gzNlxcbXlkZXZlbG9wXFxub2RlXFxuZXdleHByZXNzXzZcXHdlYmZlXFxwYWdlc1xcZmxpc3RcXGZsaXN0LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JsQkEsSUFBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLHlDQUFSLENBQWtELENBQUM7O0FBQ2xFLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLElBQUk7Ozs7O0FDRHJCLElBQUEsd0xBQUE7RUFBQTs7O0FBQUEsWUFBQSxHQUFlLE9BQUEsQ0FBUSx1Q0FBUixDQUFn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QUFZLG9CQUFaO0VBQ0EsTUFBTSxDQUFDLElBQVAsQ0FBQTtFQUNBLEtBQUssQ0FBQyxJQUFOLENBQUE7RUFDQSxNQUFNLENBQUMsSUFBUCxDQUFBO1NBQ0EsV0FBVyxDQUFDLElBQVosQ0FBQTtBQUwwQixDQUEzQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiFcclxuICogRXZlbnRFbWl0dGVyMlxyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vaGlqMW54L0V2ZW50RW1pdHRlcjJcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDEzIGhpajFueFxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXHJcbiAqL1xyXG47IWZ1bmN0aW9uKHVuZGVmaW5lZCkge1xyXG5cclxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgPyBBcnJheS5pc0FycmF5IDogZnVuY3Rpb24gX2lzQXJyYXkob2JqKSB7XHJcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcclxuICB9O1xyXG4gIHZhciBkZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XHJcblxyXG4gIGZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcclxuICAgIGlmICh0aGlzLl9jb25mKSB7XHJcbiAgICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIHRoaXMuX2NvbmYpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gY29uZmlndXJlKGNvbmYpIHtcclxuICAgIGlmIChjb25mKSB7XHJcblxyXG4gICAgICB0aGlzLl9jb25mID0gY29uZjtcclxuXHJcbiAgICAgIGNvbmYuZGVsaW1pdGVyICYmICh0aGlzLmRlbGltaXRlciA9IGNvbmYuZGVsaW1pdGVyKTtcclxuICAgICAgY29uZi5tYXhMaXN0ZW5lcnMgJiYgKHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBjb25mLm1heExpc3RlbmVycyk7XHJcbiAgICAgIGNvbmYud2lsZGNhcmQgJiYgKHRoaXMud2lsZGNhcmQgPSBjb25mLndpbGRjYXJkKTtcclxuICAgICAgY29uZi5uZXdMaXN0ZW5lciAmJiAodGhpcy5uZXdMaXN0ZW5lciA9IGNvbmYubmV3TGlzdGVuZXIpO1xyXG5cclxuICAgICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICB0aGlzLmxpc3RlbmVyVHJlZSA9IHt9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBFdmVudEVtaXR0ZXIoY29uZikge1xyXG4gICAgdGhpcy5fZXZlbnRzID0ge307XHJcbiAgICB0aGlzLm5ld0xpc3RlbmVyID0gZmFsc2U7XHJcbiAgICBjb25maWd1cmUuY2FsbCh0aGlzLCBjb25mKTtcclxuICB9XHJcblxyXG4gIC8vXHJcbiAgLy8gQXR0ZW50aW9uLCBmdW5jdGlvbiByZXR1cm4gdHlwZSBub3cgaXMgYXJyYXksIGFsd2F5cyAhXHJcbiAgLy8gSXQgaGFzIHplcm8gZWxlbWVudHMgaWYgbm8gYW55IG1hdGNoZXMgZm91bmQgYW5kIG9uZSBvciBtb3JlXHJcbiAgLy8gZWxlbWVudHMgKGxlYWZzKSBpZiB0aGVyZSBhcmUgbWF0Y2hlc1xyXG4gIC8vXHJcbiAgZnVuY3Rpb24gc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCBpKSB7XHJcbiAgICBpZiAoIXRyZWUpIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gICAgdmFyIGxpc3RlbmVycz1bXSwgbGVhZiwgbGVuLCBicmFuY2gsIHhUcmVlLCB4eFRyZWUsIGlzb2xhdGVkQnJhbmNoLCBlbmRSZWFjaGVkLFxyXG4gICAgICAgIHR5cGVMZW5ndGggPSB0eXBlLmxlbmd0aCwgY3VycmVudFR5cGUgPSB0eXBlW2ldLCBuZXh0VHlwZSA9IHR5cGVbaSsxXTtcclxuICAgIGlmIChpID09PSB0eXBlTGVuZ3RoICYmIHRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAvL1xyXG4gICAgICAvLyBJZiBhdCB0aGUgZW5kIG9mIHRoZSBldmVudChzKSBsaXN0IGFuZCB0aGUgdHJlZSBoYXMgbGlzdGVuZXJzXHJcbiAgICAgIC8vIGludm9rZSB0aG9zZSBsaXN0ZW5lcnMuXHJcbiAgICAgIC8vXHJcbiAgICAgIGlmICh0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnMpO1xyXG4gICAgICAgIHJldHVybiBbdHJlZV07XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm9yIChsZWFmID0gMCwgbGVuID0gdHJlZS5fbGlzdGVuZXJzLmxlbmd0aDsgbGVhZiA8IGxlbjsgbGVhZisrKSB7XHJcbiAgICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVyc1tsZWFmXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBbdHJlZV07XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoKGN1cnJlbnRUeXBlID09PSAnKicgfHwgY3VycmVudFR5cGUgPT09ICcqKicpIHx8IHRyZWVbY3VycmVudFR5cGVdKSB7XHJcbiAgICAgIC8vXHJcbiAgICAgIC8vIElmIHRoZSBldmVudCBlbWl0dGVkIGlzICcqJyBhdCB0aGlzIHBhcnRcclxuICAgICAgLy8gb3IgdGhlcmUgaXMgYSBjb25jcmV0ZSBtYXRjaCBhdCB0aGlzIHBhdGNoXHJcbiAgICAgIC8vXHJcbiAgICAgIGlmIChjdXJyZW50VHlwZSA9PT0gJyonKSB7XHJcbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xyXG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xyXG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzEpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcclxuICAgICAgfSBlbHNlIGlmKGN1cnJlbnRUeXBlID09PSAnKionKSB7XHJcbiAgICAgICAgZW5kUmVhY2hlZCA9IChpKzEgPT09IHR5cGVMZW5ndGggfHwgKGkrMiA9PT0gdHlwZUxlbmd0aCAmJiBuZXh0VHlwZSA9PT0gJyonKSk7XHJcbiAgICAgICAgaWYoZW5kUmVhY2hlZCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAgIC8vIFRoZSBuZXh0IGVsZW1lbnQgaGFzIGEgX2xpc3RlbmVycywgYWRkIGl0IHRvIHRoZSBoYW5kbGVycy5cclxuICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCB0eXBlTGVuZ3RoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XHJcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XHJcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gJyonIHx8IGJyYW5jaCA9PT0gJyoqJykge1xyXG4gICAgICAgICAgICAgIGlmKHRyZWVbYnJhbmNoXS5fbGlzdGVuZXJzICYmICFlbmRSZWFjaGVkKSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCB0eXBlTGVuZ3RoKSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcclxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzIpKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAvLyBObyBtYXRjaCBvbiB0aGlzIG9uZSwgc2hpZnQgaW50byB0aGUgdHJlZSBidXQgbm90IGluIHRoZSB0eXBlIGFycmF5LlxyXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVtjdXJyZW50VHlwZV0sIGkrMSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHhUcmVlID0gdHJlZVsnKiddO1xyXG4gICAgaWYgKHhUcmVlKSB7XHJcbiAgICAgIC8vXHJcbiAgICAgIC8vIElmIHRoZSBsaXN0ZW5lciB0cmVlIHdpbGwgYWxsb3cgYW55IG1hdGNoIGZvciB0aGlzIHBhcnQsXHJcbiAgICAgIC8vIHRoZW4gcmVjdXJzaXZlbHkgZXhwbG9yZSBhbGwgYnJhbmNoZXMgb2YgdGhlIHRyZWVcclxuICAgICAgLy9cclxuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4VHJlZSwgaSsxKTtcclxuICAgIH1cclxuXHJcbiAgICB4eFRyZWUgPSB0cmVlWycqKiddO1xyXG4gICAgaWYoeHhUcmVlKSB7XHJcbiAgICAgIGlmKGkgPCB0eXBlTGVuZ3RoKSB7XHJcbiAgICAgICAgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAgIC8vIElmIHdlIGhhdmUgYSBsaXN0ZW5lciBvbiBhICcqKicsIGl0IHdpbGwgY2F0Y2ggYWxsLCBzbyBhZGQgaXRzIGhhbmRsZXIuXHJcbiAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBCdWlsZCBhcnJheXMgb2YgbWF0Y2hpbmcgbmV4dCBicmFuY2hlcyBhbmQgb3RoZXJzLlxyXG4gICAgICAgIGZvcihicmFuY2ggaW4geHhUcmVlKSB7XHJcbiAgICAgICAgICBpZihicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB4eFRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xyXG4gICAgICAgICAgICBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XHJcbiAgICAgICAgICAgICAgLy8gV2Uga25vdyB0aGUgbmV4dCBlbGVtZW50IHdpbGwgbWF0Y2gsIHNvIGp1bXAgdHdpY2UuXHJcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsyKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gY3VycmVudFR5cGUpIHtcclxuICAgICAgICAgICAgICAvLyBDdXJyZW50IG5vZGUgbWF0Y2hlcywgbW92ZSBpbnRvIHRoZSB0cmVlLlxyXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2ggPSB7fTtcclxuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaFticmFuY2hdID0geHhUcmVlW2JyYW5jaF07XHJcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB7ICcqKic6IGlzb2xhdGVkQnJhbmNoIH0sIGkrMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZih4eFRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgIC8vIFdlIGhhdmUgcmVhY2hlZCB0aGUgZW5kIGFuZCBzdGlsbCBvbiBhICcqKidcclxuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XHJcbiAgICAgIH0gZWxzZSBpZih4eFRyZWVbJyonXSAmJiB4eFRyZWVbJyonXS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbJyonXSwgdHlwZUxlbmd0aCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbGlzdGVuZXJzO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gZ3Jvd0xpc3RlbmVyVHJlZSh0eXBlLCBsaXN0ZW5lcikge1xyXG5cclxuICAgIHR5cGUgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuXHJcbiAgICAvL1xyXG4gICAgLy8gTG9va3MgZm9yIHR3byBjb25zZWN1dGl2ZSAnKionLCBpZiBzbywgZG9uJ3QgYWRkIHRoZSBldmVudCBhdCBhbGwuXHJcbiAgICAvL1xyXG4gICAgZm9yKHZhciBpID0gMCwgbGVuID0gdHlwZS5sZW5ndGg7IGkrMSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIGlmKHR5cGVbaV0gPT09ICcqKicgJiYgdHlwZVtpKzFdID09PSAnKionKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRyZWUgPSB0aGlzLmxpc3RlbmVyVHJlZTtcclxuICAgIHZhciBuYW1lID0gdHlwZS5zaGlmdCgpO1xyXG5cclxuICAgIHdoaWxlIChuYW1lKSB7XHJcblxyXG4gICAgICBpZiAoIXRyZWVbbmFtZV0pIHtcclxuICAgICAgICB0cmVlW25hbWVdID0ge307XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRyZWUgPSB0cmVlW25hbWVdO1xyXG5cclxuICAgICAgaWYgKHR5cGUubGVuZ3RoID09PSAwKSB7XHJcblxyXG4gICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBsaXN0ZW5lcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZih0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBbdHJlZS5fbGlzdGVuZXJzLCBsaXN0ZW5lcl07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKGlzQXJyYXkodHJlZS5fbGlzdGVuZXJzKSkge1xyXG5cclxuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcclxuXHJcbiAgICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycy53YXJuZWQpIHtcclxuXHJcbiAgICAgICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcclxuXHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKG0gPiAwICYmIHRyZWUuX2xpc3RlbmVycy5sZW5ndGggPiBtKSB7XHJcblxyXG4gICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy53YXJuZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5sZW5ndGgpO1xyXG4gICAgICAgICAgICAgIGlmKGNvbnNvbGUudHJhY2Upe1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgICBuYW1lID0gdHlwZS5zaGlmdCgpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuXHJcbiAgLy8gMTAgbGlzdGVuZXJzIGFyZSBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoXHJcbiAgLy8gaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXHJcbiAgLy9cclxuICAvLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3NcclxuICAvLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5kZWxpbWl0ZXIgPSAnLic7XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xyXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuICAgIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBuO1xyXG4gICAgaWYgKCF0aGlzLl9jb25mKSB0aGlzLl9jb25mID0ge307XHJcbiAgICB0aGlzLl9jb25mLm1heExpc3RlbmVycyA9IG47XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5ldmVudCA9ICcnO1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pIHtcclxuICAgIHRoaXMubWFueShldmVudCwgMSwgZm4pO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5tYW55ID0gZnVuY3Rpb24oZXZlbnQsIHR0bCwgZm4pIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignbWFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbGlzdGVuZXIoKSB7XHJcbiAgICAgIGlmICgtLXR0bCA9PT0gMCkge1xyXG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgIH1cclxuICAgICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBsaXN0ZW5lci5fb3JpZ2luID0gZm47XHJcblxyXG4gICAgdGhpcy5vbihldmVudCwgbGlzdGVuZXIpO1xyXG5cclxuICAgIHJldHVybiBzZWxmO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgdmFyIHR5cGUgPSBhcmd1bWVudHNbMF07XHJcblxyXG4gICAgaWYgKHR5cGUgPT09ICduZXdMaXN0ZW5lcicgJiYgIXRoaXMubmV3TGlzdGVuZXIpIHtcclxuICAgICAgaWYgKCF0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpIHsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSAqX2FsbCogZnVuY3Rpb25zIGFuZCBpbnZva2UgdGhlbS5cclxuICAgIGlmICh0aGlzLl9hbGwpIHtcclxuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xyXG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XHJcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMuX2FsbC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcclxuICAgICAgICB0aGlzLl9hbGxbaV0uYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXHJcbiAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xyXG5cclxuICAgICAgaWYgKCF0aGlzLl9hbGwgJiZcclxuICAgICAgICAhdGhpcy5fZXZlbnRzLmVycm9yICYmXHJcbiAgICAgICAgISh0aGlzLndpbGRjYXJkICYmIHRoaXMubGlzdGVuZXJUcmVlLmVycm9yKSkge1xyXG5cclxuICAgICAgICBpZiAoYXJndW1lbnRzWzFdIGluc3RhbmNlb2YgRXJyb3IpIHtcclxuICAgICAgICAgIHRocm93IGFyZ3VtZW50c1sxXTsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5jYXVnaHQsIHVuc3BlY2lmaWVkICdlcnJvcicgZXZlbnQuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB2YXIgaGFuZGxlcjtcclxuXHJcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIGhhbmRsZXIgPSBbXTtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXIsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XHJcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKVxyXG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgLy8gc2xvd2VyXHJcbiAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XHJcbiAgICAgICAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChoYW5kbGVyKSB7XHJcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcclxuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xyXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XHJcblxyXG4gICAgICB2YXIgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xyXG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcclxuICAgICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIChsaXN0ZW5lcnMubGVuZ3RoID4gMCkgfHwgISF0aGlzLl9hbGw7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgcmV0dXJuICEhdGhpcy5fYWxsO1xyXG4gICAgfVxyXG5cclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcclxuXHJcbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhpcy5vbkFueSh0eXBlKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uIG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcclxuICAgIH1cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PSBcIm5ld0xpc3RlbmVyc1wiISBCZWZvcmVcclxuICAgIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJzXCIuXHJcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xyXG5cclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgZ3Jvd0xpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIHR5cGUsIGxpc3RlbmVyKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHtcclxuICAgICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXHJcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZih0eXBlb2YgdGhpcy5fZXZlbnRzW3R5cGVdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcclxuICAgICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XHJcblxyXG4gICAgICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xyXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcclxuXHJcbiAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xyXG5cclxuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XHJcbiAgICAgICAgICBpZihjb25zb2xlLnRyYWNlKXtcclxuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbkFueSA9IGZ1bmN0aW9uKGZuKSB7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uQW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcclxuICAgIH1cclxuXHJcbiAgICBpZighdGhpcy5fYWxsKSB7XHJcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCB0aGUgZnVuY3Rpb24gdG8gdGhlIGV2ZW50IGxpc3RlbmVyIGNvbGxlY3Rpb24uXHJcbiAgICB0aGlzLl9hbGwucHVzaChmbik7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbjtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xyXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlbW92ZUxpc3RlbmVyIG9ubHkgdGFrZXMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGhhbmRsZXJzLGxlYWZzPVtdO1xyXG5cclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAvLyBkb2VzIG5vdCB1c2UgbGlzdGVuZXJzKCksIHNvIG5vIHNpZGUgZWZmZWN0IG9mIGNyZWF0aW5nIF9ldmVudHNbdHlwZV1cclxuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xyXG4gICAgICBoYW5kbGVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgICAgbGVhZnMucHVzaCh7X2xpc3RlbmVyczpoYW5kbGVyc30pO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xyXG4gICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcclxuICAgICAgaGFuZGxlcnMgPSBsZWFmLl9saXN0ZW5lcnM7XHJcbiAgICAgIGlmIChpc0FycmF5KGhhbmRsZXJzKSkge1xyXG5cclxuICAgICAgICB2YXIgcG9zaXRpb24gPSAtMTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGhhbmRsZXJzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBpZiAoaGFuZGxlcnNbaV0gPT09IGxpc3RlbmVyIHx8XHJcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5saXN0ZW5lciAmJiBoYW5kbGVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XHJcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5fb3JpZ2luICYmIGhhbmRsZXJzW2ldLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xyXG4gICAgICAgICAgICBwb3NpdGlvbiA9IGk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHBvc2l0aW9uIDwgMCkge1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgICAgICBsZWFmLl9saXN0ZW5lcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0uc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChoYW5kbGVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgfVxyXG4gICAgICBlbHNlIGlmIChoYW5kbGVycyA9PT0gbGlzdGVuZXIgfHxcclxuICAgICAgICAoaGFuZGxlcnMubGlzdGVuZXIgJiYgaGFuZGxlcnMubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxyXG4gICAgICAgIChoYW5kbGVycy5fb3JpZ2luICYmIGhhbmRsZXJzLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xyXG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZWN1cnNpdmVseUdhcmJhZ2VDb2xsZWN0KHJvb3QpIHtcclxuICAgICAgaWYgKHJvb3QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHJvb3QpO1xyXG4gICAgICBmb3IgKHZhciBpIGluIGtleXMpIHtcclxuICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcclxuICAgICAgICB2YXIgb2JqID0gcm9vdFtrZXldO1xyXG4gICAgICAgIGlmICgob2JqIGluc3RhbmNlb2YgRnVuY3Rpb24pIHx8ICh0eXBlb2Ygb2JqICE9PSBcIm9iamVjdFwiKSlcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHJlY3Vyc2l2ZWx5R2FyYmFnZUNvbGxlY3Qocm9vdFtrZXldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICBkZWxldGUgcm9vdFtrZXldO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmVjdXJzaXZlbHlHYXJiYWdlQ29sbGVjdCh0aGlzLmxpc3RlbmVyVHJlZSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmZBbnkgPSBmdW5jdGlvbihmbikge1xyXG4gICAgdmFyIGkgPSAwLCBsID0gMCwgZm5zO1xyXG4gICAgaWYgKGZuICYmIHRoaXMuX2FsbCAmJiB0aGlzLl9hbGwubGVuZ3RoID4gMCkge1xyXG4gICAgICBmbnMgPSB0aGlzLl9hbGw7XHJcbiAgICAgIGZvcihpID0gMCwgbCA9IGZucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZihmbiA9PT0gZm5zW2ldKSB7XHJcbiAgICAgICAgICBmbnMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9hbGwgPSBbXTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZjtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAhdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuICAgICAgdmFyIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuXHJcbiAgICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xyXG4gICAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xyXG4gICAgICAgIGxlYWYuX2xpc3RlbmVycyA9IG51bGw7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbnVsbDtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xyXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICB2YXIgaGFuZGxlcnMgPSBbXTtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXJzLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xyXG4gICAgICByZXR1cm4gaGFuZGxlcnM7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuXHJcbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgdGhpcy5fZXZlbnRzW3R5cGVdID0gW107XHJcbiAgICBpZiAoIWlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLl9ldmVudHNbdHlwZV07XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnNBbnkgPSBmdW5jdGlvbigpIHtcclxuXHJcbiAgICBpZih0aGlzLl9hbGwpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2FsbDtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcblxyXG4gIH07XHJcblxyXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcclxuICAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICAgIHJldHVybiBFdmVudEVtaXR0ZXI7XHJcbiAgICB9KTtcclxuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xyXG4gICAgLy8gQ29tbW9uSlNcclxuICAgIGV4cG9ydHMuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcclxuICB9IGVsc2Uge1xyXG4gICAgLy8gQnJvd3NlciBnbG9iYWwuXHJcbiAgICB3aW5kb3cuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcclxuICB9XHJcbiAgbW9kdWxlLmV4cG9ydHMuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcclxufSgpO1xyXG4iLCJFVkVOVEVNSVRURVIgPSByZXF1aXJlKCcuLy4uLy4uL2xpYi9ldmVudGVtaXR0ZXIyL2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyXHJcbm1vZHVsZS5leHBvcnRzID0gbmV3IEVWRU5URU1JVFRFUjsiLCJFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi8uLi9saWIvZXZlbnRlbWl0dGVyMi9ldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMlxyXG5ldmVudGJ1cyA9IHJlcXVpcmUoJy4uLy4uL293bl9tb2R1bGVzL2V2ZW50YnVzL2V2ZW50YnVzJylcclxuIyBQYWdlVmlzaWJpbGl0eSA9IHJlcXVpcmUoJy4uLy4uL293bl9tb2R1bGVzL1BhZ2VWaXNpYmlsaXR5JylcclxuXHJcbiMg5pWw5o2u5Lit5b+DXHJcbmRhdGFfY2VudGVyID0ge31cclxuXHJcbmNsYXNzIEZsaXN0IGV4dGVuZHMgRXZlbnRFbWl0dGVyXHJcblx0Y29uc3RydWN0b3I6IChvcHRpb25zKS0+XHJcblx0XHQjIHN1cGVyLmFwcGx5IEAsIGFyZ3VtZW50c1xyXG5cdFx0Y29udGV4dCA9IEBcclxuXHRcdEBkZWZhdWx0cyA9IFxyXG5cdFx0XHRuYW1lOiBAZ2V0VmFsKG9wdGlvbnMubmFtZSwgJ2NqaicpXHJcblx0XHRcdGNvbnRhaW5lcjogQGdldFZhbChvcHRpb25zLmNvbnRhaW5lciwgJCgnYm9keScpKVxyXG5cdFx0XHRlbGVtOiBudWxsXHJcblx0XHRcdGZfbGlzdF90YWJsZTogbmV3IEZMaXN0VGFibGUoe1xyXG5cdFx0XHRcdGNvbnRhaW5lcjogQGdldFZhbChvcHRpb25zLmNvbnRhaW5lciwgJCgnYm9keScpKVxyXG5cdFx0XHRcdGZsaXN0OiBjb250ZXh0XHJcblx0XHRcdH0pIFxyXG5cdFx0XHRldmVudGJ1czogQGdldFZhbChvcHRpb25zLmV2ZW50YnVzLCBudWxsKVxyXG5cdFx0QGRhdGFzID0gbnVsbFxyXG5cclxuXHRcdEAub24gJ0ZsaXN0OnJlcXVlc3QnLCBAcmVxdWVzdFxyXG5cdFx0QGRlZmF1bHRzLmV2ZW50YnVzLm9uICdGbGlzdDpyZXF1ZXN0JywgQHJlcXVlc3RcclxuXHJcblx0XHRALm9uICdGTGlzdDpkYXRhQ2hhbmdlJywgQGRhdGFDaGFuZ2VcclxuXHJcblx0XHRjYWxsYmFja18gPSAoZGF0YSkgLT5cclxuXHRcdFx0Y29udGV4dC5jYWxEYXRhKGRhdGEpXHJcblx0XHRcdGNvbnRleHQucmVuZGVyKClcclxuXHRcdGV2ZW50YnVzLmVtaXQgJ0ZsaXN0OnJlcXVlc3QnLCBjYWxsYmFja19cclxuXHRcclxuXHQjIyMqXHJcblx0ICog5pu05paw5pWw5o2uXHJcblx0IyMjXHJcblx0ZGF0YUNoYW5nZTogKGRhdGEpIC0+XHJcblx0XHRjb250ZXh0ID0gQFxyXG5cdFx0Y29uc29sZS5sb2cgJ0ZsaXN0OiBkYXRhQ2hhbmdlOicsIGRhdGFcclxuXHRcdCMgc2V0VGltZW91dCgoKS0+XHJcblx0XHQjIFx0Y29uc29sZS5sb2cgJ3RvIGVtaXQgJ1xyXG5cdFx0IyBcdGNvbnRleHQuZGVmYXVsdHMuZl9saXN0X3RhYmxlLmVtaXQgJ0ZMaXN0VGFibGU6ZGF0YUNoYW5nZScsIHt9XHJcblx0XHQjICwgNTAwMClcclxuXHRcdHNlbmRfZGF0YSA9IFxyXG5cdFx0XHRlZGl0OiBkYXRhIFxyXG5cdFx0Y29uc29sZS5sb2coJ2JlZm9yZSBzZW5kIDonLCBzZW5kX2RhdGEpO1xyXG5cdFx0JC5hamF4IHtcclxuXHRcdFx0dHlwZTogJ1BPU1QnXHJcblx0XHRcdHVybDogJy9lZGl0J1xyXG5cdFx0XHRkYXRhOiBzZW5kX2RhdGFcclxuXHRcdFx0c3VjY2VzczogKGRhdGEpIC0+XHJcblx0XHRcdFx0Y29uc29sZS5sb2cgZGF0YSBcclxuXHRcdFx0XHRjb250ZXh0LmRlZmF1bHRzLmZfbGlzdF90YWJsZS5lbWl0ICdGTGlzdFRhYmxlOmRhdGFDaGFuZ2UnLCB7fVxyXG5cdFx0XHRlcnJvcjogKGRhdGEpLT5cclxuXHRcdFx0XHRjb25zb2xlLmxvZyBkYXRhIFxyXG5cdFx0XHRcdGNvbnRleHQuZGVmYXVsdHMuZl9saXN0X3RhYmxlLmVtaXQgJ0ZMaXN0VGFibGU6ZGF0YUNoYW5nZScsIHt9XHJcblx0XHR9XHJcblxyXG5cdCMjIypcclxuXHQgKiDlpITnkIbmlbDmja5cclxuXHQgKiBAcGFyYW0gIHtvYmp9IGRhdGEg5pyq5aSE55CG55qE5Ye95pWwXHJcblx0ICogQHJldHVybiB7Ym9vbH0gICAgICDmmK/lkKblkKvmnInmlbDmja5cclxuXHQjIyNcclxuXHRjYWxEYXRhOiAoZGF0YSkgLT5cclxuXHRcdGhhc19kYXRhID0gdHJ1ZVxyXG5cdFx0Zmxpc3QgPSBbXVxyXG5cdFx0ZXJyID0gJydcclxuXHRcdGlmIGRhdGFbJ3JldF9jb2RlJ10/IGFuZCBwYXJzZUludChkYXRhWydyZXRfY29kZSddKSA9PSAyMDBcclxuXHRcdFx0aWYgZGF0YVsnZGF0YSddPyBhbmQgZGF0YVsnZGF0YSddLmxlbmd0aCA+IDBcclxuXHRcdFx0XHQkLmVhY2ggZGF0YVsnZGF0YSddLCAoaSwgZSkgLT5cclxuXHRcdFx0XHRcdGZsaXN0LnB1c2gge1xyXG5cdFx0XHRcdFx0XHRpZDogZS5pZFxyXG5cdFx0XHRcdFx0XHRiZWxvbmdfaWQ6IGUuYmVsb25nX2lkXHJcblx0XHRcdFx0XHRcdGRhdGU6IGUuZGF0ZSBcclxuXHRcdFx0XHRcdFx0bnVtYmVyOiBlLm51bWJlclxyXG5cdFx0XHRcdFx0XHR0eXBlX2lkOiBlLnR5cGVfaWRcclxuXHRcdFx0XHRcdFx0dGFnX2FycjogZS50YWdfYXJyXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRjb25zb2xlLmxvZyAnZGF0YSBsZW5ndGggbGVzcyB0aGVuIDAnXHJcblx0XHRcdFx0aGFzX2RhdGEgPSBmYWxzZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRjb25zb2xlLmxvZyAncmV0X2NvZGUgbm90IDIwMCdcclxuXHRcdFx0aGFzX2RhdGEgPSBmYWxzZVxyXG5cdFx0XHRlcnIgPSBpZiBkYXRhWydlcnInXT8gdGhlbiBkYXRhWydlcnInXSBlbHNlICdodHRwIHN0YXRlIG5vdCAyMDAhJ1xyXG5cdFx0QGRhdGFzID0gXHJcblx0XHRcdGhhc19kYXRhOiBoYXNfZGF0YVxyXG5cdFx0XHRmbGlzdDogZmxpc3RcclxuXHRcdGRhdGFfY2VudGVyLmZsaXN0ID0gZmxpc3RcclxuXHRcdHJldHVybiBoYXNfZGF0YVxyXG5cclxuXHQjIyMqXHJcblx0ICog6L+U5Zueb2Jq55qE5YC877yM5LiN5a2Y5Zyo5YiZ6L+U5ZueZGVmYXVsdHNcclxuXHQjIyNcclxuXHRnZXRWYWw6IChvYmosIGRlZmF1bHRzKSAtPlxyXG5cdFx0cmV0dXJuIGlmIG9iaj8gdGhlbiBvYmogZWxzZSBkZWZhdWx0c1xyXG5cdFxyXG5cdCMjIypcclxuXHQgKiDor7vlj5blr7nosaHnmoRkYXRhc+W5tua4suafk+WvueixoVxyXG5cdCAqIEByZXR1cm4ge29ian0g5b2T5YmN5a+56LGhXHJcblx0IyMjXHJcblx0cmVuZGVyOiAoKSAtPlxyXG5cdFx0aWYgQGRhdGFzLmhhc19kYXRhXHJcblx0XHRcdCMgZXZlbnRidXMuZW1pdCAnRkxpc3RUYWJsZTpyZW5kZXJEYXRhJywgQGRhdGFzXHJcblx0XHRcdEBkZWZhdWx0cy5mX2xpc3RfdGFibGUuZW1pdCAnRkxpc3RUYWJsZTpyZW5kZXJEYXRhJywgQGRhdGFzXHJcblx0XHRlbHNlXHJcblx0XHRcdGNvbnNvbGUubG9nICfmmoLml6DmlbDmja7vvIzor7fliJvlu7onXHRcclxuXHJcblx0IyMjKlxyXG5cdCAqIOivt+axgui0ouWKoeS/oeaBr+WIl+ihqFxyXG5cdCAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayDor7fmsYLlrozmiJDlkI7osIPnlKjnmoTlh73mlbBcclxuXHQgKiBAcmV0dXJuIHtudWxsfSAgICAgICAgICAgIG5vbmVcclxuXHQjIyNcclxuXHRyZXF1ZXN0OiAoY2FsbGJhY2spIC0+XHJcblx0XHQkLmFqYXgge1xyXG5cdFx0XHR0eXBlOiAnZ2V0J1xyXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nXHJcblx0XHRcdHVybDogJy9nZXRMaXN0J1xyXG5cdFx0XHRzdWNjZXNzOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRjYWxsYmFjayhkYXRhKVxyXG5cdFx0XHRlcnJvcjogKGRhdGEpIC0+XHJcblx0XHRcdFx0Y29uc29sZS5sb2cgJ0Vycm9yJywgZGF0YVxyXG5cdFx0XHRcdGNhbGxiYWNrKGRhdGEpXHJcblx0XHRcdFx0XHJcblx0XHR9XHJcblx0c2hvdzogKCkgLT5cclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuc2hvdygpXHJcblxyXG5cdGhpZGU6ICgpIC0+XHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmhpZGUoKVxyXG5cclxuIyDotKLliqHooajmoLzmj5Lku7ZcclxuIyDog73lpJ/lop7liKDlt67mlLlcclxuY2xhc3MgRkxpc3RUYWJsZSBleHRlbmRzIEV2ZW50RW1pdHRlclxyXG5cdGNvbnN0cnVjdG9yOiAob3B0aW9ucykgLT5cclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHRAZGVmYXVsdHMgPSBcclxuXHRcdFx0bmFtZTogJ0ZMaXN0VGFibGUnXHJcblx0XHRcdGNvbnRhaW5lcjogQGdldFZhbChvcHRpb25zLmNvbnRhaW5lciwgJCgnYm9keScpKVxyXG5cdFx0XHRldmVudGJ1czogQGdldFZhbChvcHRpb25zLmV2ZW50YnVzLCBldmVudGJ1cylcclxuXHRcdFx0dGFibGU6IG51bGxcclxuXHRcdFx0ZGF0YXM6IG51bGxcclxuXHRcdFx0Zmxpc3Q6IEBnZXRWYWwob3B0aW9ucy5mbGlzdCwge30pXHJcblx0XHRALm9uICdGTGlzdFRhYmxlOnJlbmRlckRhdGEnLCBjb250ZXh0LnJlbmRlclxyXG5cdFx0QGRlZmF1bHRzLmV2ZW50YnVzLm9uICdGTGlzdFRhYmxlOnJlbmRlckRhdGEnLCBjb250ZXh0LnJlbmRlclxyXG5cdFx0QC5vbiAnRkxpc3RUYWJsZTpkYXRhQ2hhbmdlJywgY29udGV4dC5kYXRhQ2hhbmdlXHJcblx0XHRAaW5pdCgpXHJcblx0IyDmlbDmja7kv67mlLnlrozmiJDlkI5cclxuXHJcblx0ZGF0YUNoYW5nZTogKHJlcykgLT5cclxuXHRcdGNvbnNvbGUubG9nICdGTGlzdFRhYmxlOmRhdGFjaGFuZ2UgcmVzOiAnLCByZXNcclxuXHRcdCQoJyNlZGl0LWZsaXN0JykudGV4dCgnRWRpdCcpXHJcblx0XHQkKCcjZWRpdC1mbGlzdCcpLmF0dHIoJ3ZhbHVlJywgJ1NhdmUnKVxyXG5cdCMg5Yid5aeL5YyWaHRtbOWSjOaXtumXtOebkeWQrFxyXG5cdGluaXQ6ICgpIC0+XHJcblx0XHR0YWJsZV9odG1sID0gXCJcIlwiXHJcblx0XHRcdDxkaXYgY2xhc3M9XCJ1aSBpbnZlcnRlZCBzZWdtZW50XCI+XHJcblx0XHRcdFx0PGJ1dHRvbiBjbGFzcz1cInVpIGludmVydGVkIHllbGxvdyBidXR0b25cIiBpZD1cImVkaXQtZmxpc3RcIiB2YWx1ZT1cIlNhdmVcIj5FZGl0PC9idXR0b24+XHJcblx0XHRcdFx0PGJ1dHRvbiBjbGFzcz1cInVpIGludmVydGVkIHJlZCBidXR0b25cIiBpZD1cImFkZC1mbGlzdFwiPk5ldzwvYnV0dG9uPlxyXG5cdFx0XHRcdDxkaXYgY2xhc3M9XCJuZXctZmluYW5jZS1mb3JtXCI+XHJcblx0XHRcdFx0XHQ8bGFiZWwgZm9yPVwidGltZVwiPuaXtumXtDwvbGFiZWw+XHJcblx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwidWkgaW5wdXRcIj5cclxuXHRcdFx0XHRcdFx0PGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJuZXctZmluYW5jZS10aW1lXCIgZGF0ZS10aW1lLWZvcm1hdD1cIllZWVktbW0tZGRcIj5cclxuXHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0PGxhYmVsIGZvcj1cImNvc3RcIj7mgLvpop08L2xhYmVsPlxyXG5cdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpIGlucHV0XCI+XHJcblx0XHRcdFx0XHRcdDxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwibmV3LWZpbmFuY2UtY29zdFwiIGNsYXNzPVwidWkgaW52ZXJ0ZWQgaW5wdXRcIj5cclxuXHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0PGxhYmVsIGZvcj1cInRpbWVcIj7nsbvlnos8L2xhYmVsPlxyXG5cdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpIGlucHV0XCI+XHJcblx0XHRcdFx0XHRcdDxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwibmV3LWZpbmFuY2UtdHlwZVwiIGNsYXNzPVwidWkgaW52ZXJ0ZWQgaW5wdXRcIj5cclxuXHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0PGJ1dHRvbiBpZD1cInNhdmUtbmV3LWZpbmFuY2VcIiBjbGFzcz1cInVpIGJ1dHRvblwiPuS/neWtmDwvYnV0dG9uPlxyXG5cdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdDx0YWJsZSBjbGFzcz1cInVpIHNlbGVjdGFibGUgaW52ZXJ0ZWQgdGFibGVcIj5cclxuXHRcdFx0XHRcdDx0aGVhZD5cclxuXHRcdFx0XHRcdFx0PHRyPlxyXG5cdFx0XHRcdFx0XHRcdDx0aD5kYXRlPC90aD5cclxuXHRcdFx0XHRcdFx0XHQ8dGg+Y29zdDwvdGg+XHJcblx0XHRcdFx0XHRcdFx0PHRoIGNsYXNzPVwibGVmdCBhbGlnbmVkXCI+dHlwZTwvdGg+XHJcblx0XHRcdFx0XHRcdFx0PHRoIGNsYXNzPVwib3BlcmF0ZS1pdGVtLWhlYWQgZGlzcGxheS1ub25lXCI+b3BlcmF0ZTwvdGg+XHJcblx0XHRcdFx0XHRcdDwvdHI+XHJcblx0XHRcdFx0XHQ8L3RoZWFkPlxyXG5cdFx0XHRcdFx0PHRib2R5PlxyXG5cdFx0XHRcdFx0PC90Ym9keT5cclxuXHRcdFx0XHQ8L3RhYmxlPlxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdFwiXCJcIlx0XHRcclxuXHRcdHRhYmxlID0gJCh0YWJsZV9odG1sKVxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5hcHBlbmQodGFibGUpXHJcblx0XHRAZGVmYXVsdHMudGFibGUgPSB0YWJsZVxyXG5cdFx0Y29udGV4dCA9IEBcclxuXHRcdFxyXG5cdFx0IyDliJ3lp4vljJbmlrDlu7rmtojotLnorrDlvZXnmoTml7bpl7TpgInmi6nlmahcclxuXHRcdHRhYmxlLmZpbmQoJyNuZXctZmluYW5jZS10aW1lJykuZGF0ZXRpbWVwaWNrZXIoe1xyXG5cdFx0XHRsYW5nOiAnY2gnXHJcblx0XHRcdGZvcm1hdDogJ1ktbS1kJ1xyXG5cdFx0XHR0aW1lcGlja2VyOiBmYWxzZVxyXG5cdFx0XHRvbkNoYW5nZURhdGVUaW1lOiAocGFyYW1zLCBpbnB1dCwgZXZlbnQpIC0+XHJcblx0XHRcdFx0IyBldmVudC5wcmV2ZW50RGVmYXVsdCgpXHJcblx0XHRcdFx0IyBldmVudC5zdG9wUHJvcGFnYXRpb24oKVxyXG5cdFx0XHRcdCMgY29uc29sZS5sb2cgJ2NoYW5nZSBkYXRlISEnXHJcblx0XHRcdFx0IyBjb25zb2xlLmxvZyBhcmd1bWVudHMsIHBhcmFtcy5nZXRVVENEYXRlKCksIHBhcmFtcy50b0RhdGVTdHJpbmcoKSwgcGFyYW1zLnRvTG9jYWxlRGF0ZVN0cmluZygpLCBwYXJhbXMudG9Mb2NhbGVTdHJpbmcoKSwgcGFyYW1zLnRvVVRDU3RyaW5nKClcclxuXHRcdFx0XHQjIG5ld19kYXRlID0gcGFyYW1zLnRvTG9jYWxlRGF0ZVN0cmluZygpXHJcblx0XHRcdFx0IyBuZXdfZGF0ZSA9IG5ld19kYXRlLnNwbGl0KCcvJykuam9pbignLScpXHJcblx0XHRcdFx0IyBjb25zb2xlLmxvZyAnbmV3IGRhdGUgaXMgJywgbmV3X2RhdGUsICcgYW5kIGlucHV0IGlzICcsIGlucHV0XHJcblx0XHRcdFx0IyBpbnB1dC52YWwobmV3X2RhdGUpXHJcblx0XHRcdG9uU2hvdzogKHBhcmFtcykgLT5cclxuXHRcdFx0XHQjIGNvbnNvbGUubG9nIGFyZ3VtZW50c1xyXG5cdFx0fSlcclxuXHRcdHRhYmxlLmZpbmQoJyNzYXZlLW5ldy1maW5hbmNlJykub24gJ2NsaWNrJywgKGUpIC0+XHJcblx0XHRcdCRmb3JtID0gJCh0aGlzKS5jbG9zZXN0KCcubmV3LWZpbmFuY2UtZm9ybScpXHJcblx0XHRcdHRpbWUgPSAkZm9ybS5maW5kKCcjbmV3LWZpbmFuY2UtdGltZScpLnZhbCgpXHJcblx0XHRcdGNvc3QgPSAkZm9ybS5maW5kKCcjbmV3LWZpbmFuY2UtY29zdCcpLnZhbCgpXHJcblx0XHRcdHR5cGUgPSAkZm9ybS5maW5kKCcjbmV3LWZpbmFuY2UtdHlwZScpLnZhbCgpXHJcblx0XHRcdGNvbnNvbGUubG9nICdzaG93IGRhdGE6JywgdGltZSwgY29zdCwgdHlwZVxyXG5cdFx0XHRpZiB0aW1lID09ICcnIG9yIGNvc3QgPT0gJycgb3IgdHlwZSA9PSAnJ1xyXG5cdFx0XHRcdGFsZXJ0KCfor7floavlhpnlrozmlbTnmoTmtojotLnorrDlvZXvvIEnKVxyXG5cdFx0XHRpZiBpc05hTihjb3N0KVxyXG5cdFx0XHRcdGFsZXJ0KCfor7floavlhpnlkIjms5XnmoTph5Hpop0nKVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0c2VuZF9kYXRhID0gXHJcblx0XHRcdFx0XHRkYXRlOiB0aW1lXHJcblx0XHRcdFx0XHRudW1iZXI6IGNvc3RcclxuXHRcdFx0XHRcdHRhZ19hcnI6IHR5cGVcclxuXHRcdFx0XHRcdHR5cGVfaWQ6IDBcclxuXHRcdFx0XHQkLmFqYXgoe1xyXG5cdFx0XHRcdFx0dHlwZTogJ1BPU1QnXHJcblx0XHRcdFx0XHR1cmw6ICcvYWRkJ1xyXG5cdFx0XHRcdFx0ZGF0YTogc2VuZF9kYXRhXHJcblx0XHRcdFx0XHRzdWNjZXNzOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgJ3N1Y2Nlc3M6JywgZGF0YSBcclxuXHRcdFx0XHRcdFx0aWYgZGF0YS5yZXRfY29kZSA9PSAnMjAwJ1xyXG5cdFx0XHRcdFx0XHRcdGFsZXJ0ICfmt7vliqDmiJDlip8nXHJcblx0XHRcdFx0XHRcdGVsc2UgXHJcblx0XHRcdFx0XHRcdFx0YWxlcnQgJ+abtOaWsOWksei0pSdcclxuXHRcdFx0XHRcdFx0bG9jYXRpb24ucmVsb2FkKClcclxuXHRcdFx0XHRcdGVycm9yOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRcdFx0YWxlcnQgJ+a3u+WKoOWksei0pSdcclxuXHRcdFx0XHRcdFx0bG9jYXRpb24ucmVsb2FkKClcclxuXHRcdFx0XHRcdFx0IyBjb25zb2xlLmxvZyAnZXJyb3I6JywgZGF0YVxyXG5cdFx0XHRcdFx0fSlcclxuXHRcdCMg5L+u5pS55oyJ6ZKu54K55Ye75LqL5Lu255uR5ZCsXHJcblx0XHR0YWJsZS5maW5kKCcjZWRpdC1mbGlzdCcpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdFx0XHRjb25zb2xlLmxvZyAnZWRpdC1mbGlzdCBjbGljayEnXHJcblx0XHRcdGlmICQodGhpcykuYXR0cigndmFsdWUnKSA9PSAnU2F2ZSdcclxuXHRcdFx0XHQjIGNoYW5nZSB0byBlZGl0IHZpZXdcclxuXHRcdFx0XHQjIGNyZWF0ZSBkYXRldGltZXBpY2tlclxyXG5cdFx0XHRcdCQodGhpcykudGV4dCgnU2F2ZScpXHJcblx0XHRcdFx0JCh0aGlzKS5hdHRyKCd2YWx1ZScsICdFZGl0JylcclxuXHRcdFx0XHQjIOaXtumXtOmAieaLqeWZqOebkeWQrOS6i+S7tlxyXG5cdFx0XHRcdCQoJy50aW1lLWl0ZW0nKS5kYXRldGltZXBpY2tlcih7XHJcblx0XHRcdFx0XHRsYW5nOiAnY2gnXHJcblx0XHRcdFx0XHRmb3JtYXQ6ICdZWVlZLW1tLWRkJ1xyXG5cdFx0XHRcdFx0dGltZXBpY2tlcjogZmFsc2VcclxuXHRcdFx0XHRcdG9uQ2hhbmdlRGF0ZVRpbWU6IChwYXJhbXMsIGlucHV0LCBldmVudCkgLT5cclxuXHRcdFx0XHRcdFx0IyDlkITnp43ml7bpl7TmoLzlvI9cclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgYXJndW1lbnRzLCBwYXJhbXMuZ2V0VVRDRGF0ZSgpLCBwYXJhbXMudG9EYXRlU3RyaW5nKCksIHBhcmFtcy50b0xvY2FsZURhdGVTdHJpbmcoKSwgcGFyYW1zLnRvTG9jYWxlU3RyaW5nKCksIHBhcmFtcy50b1VUQ1N0cmluZygpXHJcblx0XHRcdFx0XHRcdCMg55uu5YmN55So55qE5pivIHRvTG9jYWxlRGF0ZVN0cmluZ1xyXG5cdFx0XHRcdFx0XHQjICQodGhpcykudGV4dChwYXJhbXMudG9Mb2NhbGVEYXRlU3RyaW5nKCkpXHJcblx0XHRcdFx0XHRcdG5ld19kYXRlID0gcGFyYW1zLnRvTG9jYWxlRGF0ZVN0cmluZygpXHJcblx0XHRcdFx0XHRcdG5ld19kYXRlID0gbmV3X2RhdGUuc3BsaXQoJy8nKS5qb2luKCctJylcclxuXHRcdFx0XHRcdFx0aW5wdXQudGV4dChuZXdfZGF0ZSlcclxuXHJcblx0XHRcdFx0XHRvblNob3c6IChwYXJhbXMpIC0+XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nIGFyZ3VtZW50c1xyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0XHRjb3N0SW5wdXQgPSAoZSkgLT5cclxuXHRcdFx0XHRcdGlmICQodGhpcykuZmluZCgnaW5wdXQnKS5sZW5ndGggPT0gMFxyXG5cdFx0XHRcdFx0XHRvbGQgPSAkKHRoaXMpLnRleHQoKVxyXG5cdFx0XHRcdFx0XHQkKHRoaXMpLmF0dHIoJ3ZhbCcsIG9sZClcclxuXHRcdFx0XHRcdFx0aW5wdXRfaHRtbCA9IFwiXCJcIjxpbnB1dCBjbGFzcz1cInVpIGludmVydGVkIGlucHV0XCIgdHlwZT1cInRleHRcIiB2YWx1ZT1cIiN7b2xkfVwiLz5cIlwiXCJcclxuXHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKGlucHV0X2h0bWwpXHJcblx0XHRcdFx0JCgnLmNvc3QtaXRlbScpLm9uICdjbGljaycsIGNvc3RJbnB1dFxyXG5cdFx0XHRcdHR5cGVJbnB1dCA9IChlKSAtPlxyXG5cdFx0XHRcdFx0aWYgJCh0aGlzKS5maW5kKCdpbnB1dCcpLmxlbmd0aCA9PSAwXHJcblx0XHRcdFx0XHRcdG9sZCA9ICQodGhpcykudGV4dCgpXHJcblx0XHRcdFx0XHRcdCQodGhpcykuYXR0cigndmFsJywgb2xkKVxyXG5cdFx0XHRcdFx0XHRpbnB1dF9odG1sID0gXCJcIlwiPGlucHV0IGNsYXNzPVwidWkgaW52ZXJ0ZWQgaW5wdXRcIiB0eXBlPVwidGV4dFwiIHZhbHVlPVwiI3tvbGR9XCIvPlwiXCJcIlxyXG5cdFx0XHRcdFx0XHQkKHRoaXMpLmh0bWwoaW5wdXRfaHRtbClcclxuXHRcdFx0XHQkKCcudHlwZS1pdGVtJykub24gJ2NsaWNrJywgdHlwZUlucHV0XHRcclxuXHRcdFx0XHQjIOaYvuekuuWIoOmZpOeahOmAiemhuVxyXG5cdFx0XHRcdCQoJy5vcGVyYXRlLWl0ZW0taGVhZCcpLnJlbW92ZUNsYXNzKCdkaXNwbGF5LW5vbmUnKVxyXG5cdFx0XHRcdCQoJy5vcGVyYXRlLWl0ZW0nKS5yZW1vdmVDbGFzcygnZGlzcGxheS1ub25lJylcclxuXHRcdFx0IyDkv53lrZjkv67mlLnlkI7nmoTmlbDmja5cclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdCMg5Y+W5raI5pe26Ze06YCJ5oup5ZmoXHJcblx0XHRcdFx0JCgnLnRpbWUtaXRlbScpLmRhdGV0aW1lcGlja2VyKCdkZXN0cm95JylcclxuXHRcdFx0XHQkLmVhY2ggJCgnLmNvc3QtaXRlbScpLCAoaSwgZSkgLT5cclxuXHRcdFx0XHRcdCRpbnB1dCA9ICQodGhpcykuZmluZCgnaW5wdXQnKVxyXG5cdFx0XHRcdFx0aWYgJGlucHV0Lmxlbmd0aCAhPSAwXHJcblx0XHRcdFx0XHRcdCMgbmV3X3ZhbCA9ICQodGhpcykuYXR0cigndmFsJylcclxuXHRcdFx0XHRcdFx0bmV3X3ZhbCA9ICRpbnB1dC52YWwoKVxyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyAkKHRoaXMpLCAkKHRoaXMpLmF0dHIoJ3ZhbCcpLCBuZXdfdmFsXHJcblx0XHRcdFx0XHRcdHJlZyA9IC9eW2EtekEtWjAtOVxcdTRlMDAtXFx1OWZhNSBdKyQvXHJcblxyXG5cdFx0XHRcdFx0XHRpZiByZWcudGVzdChuZXdfdmFsKSA9PSB0cnVlXHJcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgJ3RydWUgd2hpbGUgdGVzdCB0aGUgcmVnOicsIG5ld192YWxcclxuXHRcdFx0XHRcdFx0XHQkKHRoaXMpLmh0bWwobmV3X3ZhbClcclxuXHRcdFx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nIG5ld192YWwsICcgaXMgZmFsc2Ugd2hpbGUgdGVzdCB0aGUgcmVnJ1xyXG5cdFx0XHRcdFx0XHRcdCQodGhpcykuaHRtbCgkKHRoaXMpLmF0dHIoJ3ZhbCcpKVxyXG5cdFx0XHRcdCQuZWFjaCAkKCcudHlwZS1pdGVtJyksIChpLCBlKSAtPlxyXG5cdFx0XHRcdFx0JGlucHV0ID0gJCh0aGlzKS5maW5kKCdpbnB1dCcpXHJcblx0XHRcdFx0XHRpZiAkaW5wdXQubGVuZ3RoICE9IDBcclxuXHRcdFx0XHRcdFx0bmV3X3ZhbCA9ICRpbnB1dC52YWwoKVxyXG5cdFx0XHRcdFx0XHRpZiBuZXdfdmFsICE9ICcnXHJcblx0XHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKG5ld192YWwpXHJcblx0XHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0XHQkKHRoaXMpLmh0bWwoJCh0aGlzKS5hdHRyKCd2YWwnKSlcclxuXHRcdFx0XHQjIGNoYW5nZSB0byBzYXZlIHZpZXdcclxuXHRcdFx0XHQjIHJlcXVlc3QgdG8gdXBhdGUgZGF0YVxyXG5cdFx0XHRcdGNvbnNvbGUubG9nICdkZWZhdWx0czonLCBjb250ZXh0LmRlZmF1bHRzXHJcblx0XHRcdFx0IyDmm7TmlrDlt7Lkv67mlLnnmoTmlbDmja7vvIznhLblkI7op6blj5FmbGlzdOeahGRhdGFjaGFuZ2U6XHJcblx0XHRcdFx0JGZfbGlzdCA9IGNvbnRleHQuZGVmYXVsdHMuY29udGFpbmVyLmZpbmQoJ3Rib2R5IHRyJylcclxuXHRcdFx0XHRmX2xpc3RfZGF0YSA9IFtdXHJcblx0XHRcdFx0JC5lYWNoICRmX2xpc3QsIChpLCBlKSAtPlxyXG5cdFx0XHRcdFx0dGltZSA9ICRmX2xpc3QuZXEoaSkuZmluZCgnLnRpbWUtaXRlbScpLnRleHQoKVxyXG5cdFx0XHRcdFx0Y29zdCA9ICRmX2xpc3QuZXEoaSkuZmluZCgnLmNvc3QtaXRlbScpLnRleHQoKVxyXG5cdFx0XHRcdFx0dHlwZSA9ICRmX2xpc3QuZXEoaSkuZmluZCgnLnR5cGUtaXRlbScpLnRleHQoKVxyXG5cdFx0XHRcdFx0aWQgPSAkZl9saXN0LmVxKGkpLmF0dHIoJ2FsdCcpXHJcblx0XHRcdFx0XHRmX2xpc3RfZGF0YS5wdXNoIHtcclxuXHRcdFx0XHRcdFx0aWQ6IGlkXHJcblx0XHRcdFx0XHRcdGRhdGUgOiB0aW1lXHJcblx0XHRcdFx0XHRcdG51bWJlciA6IGNvc3QgXHJcblx0XHRcdFx0XHRcdHRhZ19hcnIgOiB0eXBlXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0Y29udGV4dC5kZWZhdWx0cy5kYXRhcyA9IGZfbGlzdF9kYXRhXHJcblx0XHRcdFx0Y29udGV4dC5kZWZhdWx0cy5mbGlzdC5lbWl0ICdGTGlzdDpkYXRhQ2hhbmdlJywgY29udGV4dC5kZWZhdWx0cy5kYXRhc1xyXG5cdFx0XHRcdCMg5Y+W5raI57uR5a6aXHJcblx0XHRcdFx0JCgnLmNvc3QtaXRlbScpLnVuYmluZCgnY2xpY2snKVxyXG5cdFx0XHRcdCQoJy50eXBlLWl0ZW0nKS51bmJpbmQoJ2NsaWNrJylcclxuXHRcdFx0XHQjIOmakOiXj+WIoOmZpOmAiemhuVxyXG5cdFx0XHRcdCQoJy5vcGVyYXRlLWl0ZW0taGVhZCcpLmFkZENsYXNzKCdkaXNwbGF5LW5vbmUnKVxyXG5cdFx0XHRcdCQoJy5vcGVyYXRlLWl0ZW0nKS5hZGRDbGFzcygnZGlzcGxheS1ub25lJylcclxuXHRcdCMg5re75Yqg5oyJ6ZKu54K55Ye75LqL5Lu255uR5ZCsXHJcblx0XHR0YWJsZS5maW5kKCcjYWRkLWZsaXN0Jykub24gJ2NsaWNrJywgKGUpIC0+XHJcblx0XHRcdGNvbnNvbGUubG9nICd0byBhZGQgbmV3IGZpbmFuY2UnXHJcblx0XHRcdGNvbnRleHQuZGVmYXVsdHMuY29udGFpbmVyLmZpbmQoJy5uZXctZmluYW5jZS1mb3JtJykuc2hvdygpXHJcblx0XHQjIOWIoOmZpOaMiemSrueCueWHu+S6i+S7tuebkeWQrFxyXG5cdFx0dGFibGUuZmluZCgndGJvZHknKS5vbiAnY2xpY2snLCAnLm9wZXJhdGUtaXRlbScsIChlKSAtPlxyXG5cdFx0XHR0aGF0ID0gJCh0aGlzKS5jbG9zZXN0KCd0cicpXHJcblx0XHRcdGZpbmFuY2VfaWQgPSB0aGF0LmF0dHIoJ2FsdCcpXHJcblx0XHRcdHNlbmRfZGF0YSA9IFxyXG5cdFx0XHRcdGZpbmFuY2VfaWQ6IGZpbmFuY2VfaWRcclxuXHRcdFx0JC5hamF4KHtcclxuXHRcdFx0XHR0eXBlOiAnUE9TVCdcclxuXHRcdFx0XHR1cmw6ICcvZGVsJ1xyXG5cdFx0XHRcdGRhdGE6IHNlbmRfZGF0YVxyXG5cdFx0XHRcdHN1Y2Nlc3M6IChkYXRhKSAtPlxyXG5cdFx0XHRcdFx0aWYgZGF0YS5yZXRfY29kZSA9PSAnMjAwJ1xyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyAnZGVsZXRlIG9rISdcclxuXHRcdFx0XHRcdFx0dGhhdC5yZW1vdmUoKVxyXG5cdFx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyAnZGVsZXRlIGZhaWwnXHJcblx0XHRcdFx0ZXJyb3I6IChkYXRhKSAtPlxyXG5cdFx0XHRcdFx0Y29uc29sZS5sb2cgJ2RlbGV0ZSBmYWlsJ1xyXG5cdFx0XHR9KVxyXG5cclxuXHRnZXRWYWw6IChvYmosIGRlZmF1bHRzKSAtPlxyXG5cdFx0cmV0dXJuIGlmIG9iaj8gdGhlbiBvYmogZWxzZSBkZWZhdWx0c1xyXG5cclxuXHRyZW5kZXI6IChkYXRhcykgLT5cclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHRAZGVmYXVsdHMuZGF0YXMgPSBkYXRhc1xyXG5cdFx0Y29uc29sZS5sb2cgZGF0YXNcclxuXHRcdGl0ZW1zX2h0bWwgPSAnJ1xyXG5cdFx0JC5lYWNoIGRhdGFzLmZsaXN0LCAoaSwgZSkgLT5cclxuXHRcdFx0ZGF0ZV8gPSBlLmRhdGUuc2xpY2UoMCwgMTApXHJcblx0XHRcdGNvc3RfID0gZS5udW1iZXJcclxuXHRcdFx0dHlwZV8gPSBlLnRhZ19hcnIuam9pbignICcpXHJcblx0XHRcdGlkXyA9IGUuaWRcclxuXHRcdFx0aXRlbV9odG1sID0gXCJcIlwiXHJcblx0XHRcdFx0PHRyIGFsdD1cIiN7aWRffVwiPlxyXG5cdFx0XHRcdFx0PHRkIGNsYXNzPVwidGltZS1pdGVtXCI+I3tkYXRlX308L3RkPlxyXG5cdFx0XHRcdFx0PHRkIGNsYXNzPVwiY29zdC1pdGVtXCI+I3tjb3N0X308L3RkPlxyXG5cdFx0XHRcdFx0PHRkIGNsYXNzPVwidHlwZS1pdGVtXCI+I3t0eXBlX308L3RkPlxyXG5cdFx0XHRcdFx0PHRkIGNsYXNzPVwib3BlcmF0ZS1pdGVtIGRpc3BsYXktbm9uZVwiPmRlbGV0ZTwvdGQ+XHJcblx0XHRcdFx0PC90cj5cclxuXHRcdFx0XCJcIlwiXHJcblx0XHRcdGl0ZW1zX2h0bWwgKz0gaXRlbV9odG1sXHJcblx0XHRAZGVmYXVsdHMudGFibGUuZmluZCgndGJvZHknKS5odG1sKGl0ZW1zX2h0bWwpXHJcblxyXG4jIOWvueaUtuWFpeaUr+WHuuWBmue7n+iuoe+8jOWPr+inhuWMllxyXG5jbGFzcyBDb3N0Q2hhcnRTaG93IGV4dGVuZHMgRXZlbnRFbWl0dGVyXHJcblx0Y29uc3RydWN0b3I6IChvcHRpb25zKSAtPlxyXG5cdFx0QGRlZmF1bHRzID0gXHJcblx0XHRcdGNvbnRhaW5lcjogQGdldFZhbChvcHRpb25zLmNvbnRhaW5lciwgJCgnYm9keScpKVxyXG5cdFx0XHRcclxuXHRcdEBpbml0KClcclxuXHRpbml0OiAoKSAtPlxyXG5cdFx0Y2hhcnRfaHRtbCA9IFwiXCJcIlxyXG5cdFx0XHQ8ZGl2IGlkPVwiY29zdC1jaGFydC1jb250YWluZXJcIiBjbGFzcz1cImNoYXJ0X2NvbnRhaW5lclwiIHN0eWxlPVwid2lkdGg6IDYwMHB4OyBoZWlnaHQ6IDQwMHB4O1wiPjwvZGl2PlxyXG5cdFx0XCJcIlwiXHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmhpZGUoKVxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5odG1sKGNoYXJ0X2h0bWwpXHJcblx0XHRpZiBkYXRhX2NlbnRlci5mbGlzdCAhPSBudWxsXHJcblx0XHRcdEBkZWZhdWx0cy5kYXRhID0gZGF0YV9jZW50ZXIuZmxpc3RcclxuXHRcdFx0QHNob3dDb3N0Q2hhcnQoKVxyXG5cdHNob3dDb3N0Q2hhcnQ6ICgpIC0+XHJcblx0XHRpZiBkYXRhX2NlbnRlci5mbGlzdCA9PSBudWxsIG9yIHR5cGVvZiBkYXRhX2NlbnRlci5mbGlzdCA9PSAndW5kZWZpbmVkJ1xyXG5cdFx0XHRyZXR1cm5cclxuXHRcdGVsc2UgXHJcblx0XHRcdGZsaXN0XyA9IGRhdGFfY2VudGVyLmZsaXN0XHJcblx0XHRcdGNvbnNvbGUubG9nICdmbGlzdF86JywgZmxpc3RfXHJcblx0XHRcdGRhdGUgPSBbXVxyXG5cdFx0XHRkYXRhID0gW11cclxuXHRcdFx0Y2FsX2RhdGEgPSB7fVxyXG5cdFx0XHRmb3IgZiBpbiBmbGlzdF9cclxuXHRcdFx0XHQjIGRhdGUucHVzaCBmLmRhdGUuc2xpY2UoMCwgMTApXHJcblx0XHRcdFx0IyBkYXRhLnB1c2ggZi5udW1iZXJcclxuXHRcdFx0XHRkYXRlXyA9IGYuZGF0ZS5zbGljZSgwLCAxMClcclxuXHRcdFx0XHRpZiBjYWxfZGF0YVtkYXRlX10/XHJcblx0XHRcdFx0XHRjYWxfZGF0YVtkYXRlX10gKz0gZi5udW1iZXJcclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRjYWxfZGF0YVtkYXRlX10gPSBmLm51bWJlclxyXG5cdFx0XHRmb3IgYyBvZiBjYWxfZGF0YVxyXG5cdFx0XHRcdGRhdGUucHVzaCBjXHJcblx0XHRcdFx0ZGF0YS5wdXNoIGNhbF9kYXRhW2NdXHJcblx0XHRcdGNvc3RfY2hhcnQgPSBlY2hhcnRzLmluaXQoJCgnI2Nvc3QtY2hhcnQtY29udGFpbmVyJylbMF0pXHJcblx0XHRcdCMgYmFzZSA9IChuZXcgRGF0ZSgyMDE1LCA5LCA0KSkudmFsdWVPZigpXHJcblx0XHRcdCMgb25lRGF5ID0gMjQgKiAzNjAwICogMTAwMFxyXG5cdFx0XHQjIGRhdGUgPSBbXVxyXG5cdFx0XHQjIGRhdGEgPSBbTWF0aC5yYW5kb20oKSAqIDE1MF1cclxuXHJcblx0XHRcdCMgZm9yIGkgaW4gWzAuLjEwMF1cclxuXHRcdFx0IyBcdG5vdyAgPSBuZXcgRGF0ZShiYXNlICs9IG9uZURheSlcclxuXHRcdFx0IyBcdGRhdGUucHVzaChbbm93LmdldEZ1bGxZZWFyKCksIG5vdy5nZXRNb250aCgpICsgMSwgbm93LmdldERhdGUoKV0uam9pbignLScpKVxyXG5cdFx0XHQjIFx0ZGF0YS5wdXNoKChNYXRoLnJhbmRvbSgpIC0gLjQpICogMjApICsgZGF0YVtpIC0gMV07XHJcblx0XHRcdG9wdGlvbiA9IHtcclxuXHRcdFx0XHR0aXRsZToge1xyXG5cdFx0XHRcdFx0eDogJ2NlbnRlcicsXHJcblx0XHRcdFx0XHR0ZXh0OiAn5pS25YWl5pSv5Ye6JyxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdCMgbGVnZW5kOiB7XHJcblx0XHRcdFx0IyBcdHRvcDogJ2JvdHRvbScsXHJcblx0XHRcdFx0IyBcdGRhdGE6WyfmhI/lkJEnXVxyXG5cdFx0XHRcdCMgfSxcclxuXHRcdFx0XHR0b29sYm94OiB7XHJcblx0XHRcdFx0XHRzaG93OiBmYWxzZSxcclxuXHRcdFx0XHRcdGZlYXR1cmU6IHtcclxuXHRcdFx0XHRcdFx0bWFyazoge3Nob3c6IHRydWV9LFxyXG5cdFx0XHRcdFx0XHRkYXRhVmlldzoge3Nob3c6IHRydWUsIHJlYWRPbmx5OiBmYWxzZX0sXHJcblx0XHRcdFx0XHRcdG1hZ2ljVHlwZToge3Nob3c6IHRydWUsIHR5cGU6IFsnbGluZScsICdiYXInLCAnc3RhY2snLCAndGlsZWQnXX0sXHJcblx0XHRcdFx0XHRcdHJlc3RvcmU6IHtzaG93OiB0cnVlfSxcclxuXHRcdFx0XHRcdFx0c2F2ZUFzSW1hZ2U6IHtzaG93OiB0cnVlfVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0eEF4aXM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ2NhdGVnb3J5JyxcclxuXHRcdFx0XHRcdFx0Ym91bmRhcnlHYXA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0XHRkYXRhOiBkYXRlXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XSxcclxuXHRcdFx0XHR5QXhpczogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAndmFsdWUnLFxyXG5cdFx0XHRcdFx0XHQjIG1heDogNTAwXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XSxcclxuXHRcdFx0XHRkYXRhWm9vbToge1xyXG5cdFx0XHRcdFx0dHlwZTogJ2luc2lkZScsXHJcblx0XHRcdFx0XHRzdGFydDogNjAsXHJcblx0XHRcdFx0XHRlbmQ6IDgwXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRzZXJpZXM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTon5oiQ5LqkJyxcclxuXHRcdFx0XHRcdFx0dHlwZTonbGluZScsXHJcblx0XHRcdFx0XHRcdHNtb290aDp0cnVlLFxyXG5cdFx0XHRcdFx0XHRzeW1ib2w6ICdub25lJyxcclxuXHRcdFx0XHRcdFx0c3RhY2s6ICdhJyxcclxuXHRcdFx0XHRcdFx0YXJlYVN0eWxlOiB7XHJcblx0XHRcdFx0XHRcdFx0bm9ybWFsOiB7fVxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRkYXRhOiBkYXRhXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb3N0X2NoYXJ0LnNldE9wdGlvbihvcHRpb24pXHJcblx0XHJcblx0IyMjKlxyXG5cdCAqIOi/lOWbnm9iaueahOWAvO+8jOS4jeWtmOWcqOWImei/lOWbnmRlZmF1bHRzXHJcblx0IyMjXHJcblx0Z2V0VmFsOiAob2JqLCBkZWZhdWx0cykgLT5cclxuXHRcdHJldHVybiBpZiBvYmo/IHRoZW4gb2JqIGVsc2UgZGVmYXVsdHNcclxuXHRcclxuXHRzaG93OiAoKSAtPlxyXG5cdFx0QHNob3dDb3N0Q2hhcnQoKVxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5zaG93KClcclxuXHJcblx0aGlkZTogKCkgLT5cclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaGlkZSgpXHJcblxyXG4jIOWvuea2iOi0ueiMg+WbtOWBmue7n+iuoe+8jOWPr+inhuWMllxyXG5jbGFzcyBSYW5nZUNoYXJ0U2hvdyBleHRlbmRzIEV2ZW50RW1pdHRlclxyXG5cdGNvbnN0cnVjdG9yOiAob3B0aW9ucykgLT5cclxuXHRcdEBkZWZhdWx0cyA9IFxyXG5cdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdEBpbml0KClcclxuXHRpbml0OiAoKSAtPlxyXG5cdFx0Y2hhcnRfaHRtbCA9IFwiXCJcIlxyXG5cdFx0XHQ8ZGl2IGlkPVwicmFuZ2UtY2hhcnQtY29udGFpbmVyXCIgY2xhc3M9XCJjaGFydF9jb250YWluZXJcIiBzdHlsZT1cIndpZHRoOiA2MDBweDsgaGVpZ2h0OiA0MDBweDtcIj48L2Rpdj5cclxuXHRcdFwiXCJcIlxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5oaWRlKClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaHRtbChjaGFydF9odG1sKVxyXG5cdFx0aWYgZGF0YV9jZW50ZXIuZmxpc3QgIT0gbnVsbFxyXG5cdFx0XHRAZGVmYXVsdHMuZGF0YSA9IGRhdGFfY2VudGVyLmZsaXN0XHJcblx0XHRcdEBzaG93UmFuZ2VDaGFydCgpXHJcblxyXG5cdHVwZGF0ZTogKCkgLT5cclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ICE9IG51bGxcclxuXHRcdFx0QGRlZmF1bHRzLmRhdGEgPSBkYXRhX2NlbnRlci5mbGlzdFxyXG5cdFx0XHRAc2hvd1JhbmdlQ2hhcnQoKVxyXG5cclxuXHRzaG93UmFuZ2VDaGFydDogKCkgLT5cclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ID09IG51bGwgb3IgdHlwZW9mIGRhdGFfY2VudGVyLmZsaXN0ID09ICd1bmRlZmluZWQnXHJcblx0XHRcdHJldHVyblxyXG5cdFx0ZWxzZSBcclxuXHRcdFx0dGFnX21hcCA9IHt9XHJcblx0XHRcdGZvciBmIGluIGRhdGFfY2VudGVyLmZsaXN0XHJcblx0XHRcdFx0dGFnX2FyciA9IGYudGFnX2FyclxyXG5cdFx0XHRcdGZvciB0IGluIHRhZ19hcnJcclxuXHRcdFx0XHRcdGlmIHRhZ19tYXBbdF0/XHJcblx0XHRcdFx0XHRcdHRhZ19tYXBbdF0rK1xyXG5cdFx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0XHR0YWdfbWFwW3RdID0gMVxyXG5cdFx0XHRjb25zb2xlLmxvZyAndGFnX21hcDonLCB0YWdfbWFwXHJcblx0XHRcdGRhdGEgPSBbXVxyXG5cdFx0XHRmb3IgdCBvZiB0YWdfbWFwXHJcblx0XHRcdFx0ZGF0YS5wdXNoIHtcclxuXHRcdFx0XHRcdG5hbWU6IHQsXHJcblx0XHRcdFx0XHR2YWx1ZTogdGFnX21hcFt0XVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdGNvc3RfY2hhcnQgPSBlY2hhcnRzLmluaXQoJCgnI3JhbmdlLWNoYXJ0LWNvbnRhaW5lcicpWzBdKVxyXG5cdFx0XHRvcHRpb24gPSB7XHJcblx0XHRcdCAgICBiYWNrZ3JvdW5kQ29sb3I6ICcjMmMzNDNjJyxcclxuXHRcdFx0ICAgIHRpdGxlOiB7XHJcblx0XHRcdCAgICAgICAgdGV4dDogJ0N1c3RvbWl6ZWQgUGllJyxcclxuXHRcdFx0ICAgICAgICBsZWZ0OiAnY2VudGVyJyxcclxuXHRcdFx0ICAgICAgICB0b3A6IDIwLFxyXG5cdFx0XHQgICAgICAgIHRleHRTdHlsZToge1xyXG5cdFx0XHQgICAgICAgICAgICBjb2xvcjogJyNjY2MnXHJcblx0XHRcdCAgICAgICAgfVxyXG5cdFx0XHQgICAgfSxcclxuXHJcblx0XHRcdCAgICB0b29sdGlwIDoge1xyXG5cdFx0XHQgICAgICAgIHRyaWdnZXI6ICdpdGVtJyxcclxuXHRcdFx0ICAgICAgICBmb3JtYXR0ZXI6IFwie2F9IDxici8+e2J9IDoge2N9ICh7ZH0lKVwiXHJcblx0XHRcdCAgICB9LFxyXG5cclxuXHRcdFx0ICAgIHZpc3VhbE1hcDoge1xyXG5cdFx0XHQgICAgICAgIHNob3c6IGZhbHNlLFxyXG5cdFx0XHQgICAgICAgIG1pbjogODAsXHJcblx0XHRcdCAgICAgICAgbWF4OiA2MDAsXHJcblx0XHRcdCAgICAgICAgaW5SYW5nZToge1xyXG5cdFx0XHQgICAgICAgICAgICBjb2xvckxpZ2h0bmVzczogWzAuMiwgMV1cclxuXHRcdFx0ICAgICAgICB9XHJcblx0XHRcdCAgICB9LFxyXG5cdFx0XHQgICAgc2VyaWVzIDogW1xyXG5cdFx0XHQgICAgICAgIHtcclxuXHRcdFx0ICAgICAgICAgICAgbmFtZTon5raI6LS56aKG5Z+fJyxcclxuXHRcdFx0ICAgICAgICAgICAgdHlwZToncGllJyxcclxuXHRcdFx0ICAgICAgICAgICAgcmFkaXVzIDogJzU1JScsXHJcblx0XHRcdCAgICAgICAgICAgIGNlbnRlcjogWyc1MCUnLCAnNTAlJ10sXHJcblx0XHRcdCAgICAgICAgICAgIGRhdGE6ZGF0YS5zb3J0KCAoYSwgYiktPiAgcmV0dXJuIGEudmFsdWUgLSBiLnZhbHVlKSxcclxuXHRcdFx0ICAgICAgICAgICAgcm9zZVR5cGU6ICdhbmdsZScsXHJcblx0XHRcdCAgICAgICAgICAgIGxhYmVsOiB7XHJcblx0XHRcdCAgICAgICAgICAgICAgICBub3JtYWw6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICB0ZXh0U3R5bGU6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6ICdyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMyknXHJcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgfVxyXG5cdFx0XHQgICAgICAgICAgICAgICAgfVxyXG5cdFx0XHQgICAgICAgICAgICB9LFxyXG5cdFx0XHQgICAgICAgICAgICBsYWJlbExpbmU6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgIG5vcm1hbDoge1xyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIGxpbmVTdHlsZToge1xyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogJ3JnYmEoMjU1LCAyNTUsIDI1NSwgMC4zKSdcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICB9LFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIHNtb290aDogMC4yLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIGxlbmd0aDogMTAsXHJcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgbGVuZ3RoMjogMjBcclxuXHRcdFx0ICAgICAgICAgICAgICAgIH1cclxuXHRcdFx0ICAgICAgICAgICAgfSxcclxuXHRcdFx0ICAgICAgICAgICAgaXRlbVN0eWxlOiB7XHJcblx0XHRcdCAgICAgICAgICAgICAgICBub3JtYWw6IHtcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICBjb2xvcjogJyNjMjM1MzEnLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgIHNoYWRvd0JsdXI6IDIwMCxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICBzaGFkb3dDb2xvcjogJ3JnYmEoMCwgMCwgMCwgMC41KSdcclxuXHRcdFx0ICAgICAgICAgICAgICAgIH1cclxuXHRcdFx0ICAgICAgICAgICAgfVxyXG5cdFx0XHQgICAgICAgIH1cclxuXHRcdFx0ICAgIF1cclxuXHRcdFx0fTtcclxuXHRcdFx0Y29zdF9jaGFydC5zZXRPcHRpb24ob3B0aW9uKVxyXG5cclxuXHQjIyMqXHJcblx0ICog6L+U5Zueb2Jq55qE5YC877yM5LiN5a2Y5Zyo5YiZ6L+U5ZueZGVmYXVsdHNcclxuXHQjIyNcclxuXHRnZXRWYWw6IChvYmosIGRlZmF1bHRzKSAtPlxyXG5cdFx0cmV0dXJuIGlmIG9iaj8gdGhlbiBvYmogZWxzZSBkZWZhdWx0c1xyXG5cdHNob3c6ICgpIC0+XHJcblx0XHRAdXBkYXRlKClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuc2hvdygpXHJcblxyXG5cdGhpZGU6ICgpIC0+XHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmhpZGUoKVxyXG5cclxuXHJcbiMg5a+55Liq5Lq655qE5raI6LS55YGa6K+N5LqR55qE5Y+v6KeG5YyWXHJcbmNsYXNzIFdvcmRDbG91ZCBleHRlbmRzIEV2ZW50RW1pdHRlclxyXG5cdGNvbnN0cnVjdG9yOiAob3B0aW9ucykgLT5cclxuXHRcdEBkZWZhdWx0cyA9IFxyXG5cdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdEBpbml0KClcclxuXHRpbml0OiAoKSAtPlxyXG5cdFx0ZDNfaHRtbCA9IFwiXCJcIlxyXG5cdFx0XHQ8ZGl2IGlkPVwid29yZC1jbG91ZC1jb250YWluZXJcIiBjbGFzcz1cImNoYXJ0X2NvbnRhaW5lclwiIHN0eWxlPVwid2lkdGg6IDEyMDBweDsgaGVpZ2h0OiA4MDBweDtcIj48L2Rpdj5cclxuXHRcdFwiXCJcIlxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5oaWRlKClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuaHRtbChkM19odG1sKVxyXG5cdFx0aWYgZGF0YV9jZW50ZXIuZmxpc3QgIT0gbnVsbFxyXG5cdFx0XHRAZGVmYXVsdHMuZGF0YSA9IGRhdGFfY2VudGVyLmZsaXN0XHJcblx0XHRcdEBzaG93V29yZENsb3VkKClcclxuXHJcblx0dXBkYXRlOiAoKSAtPlxyXG5cdFx0aWYgZGF0YV9jZW50ZXIuZmxpc3QgIT0gbnVsbFxyXG5cdFx0XHRAZGVmYXVsdHMuZGF0YSA9IGRhdGFfY2VudGVyLmZsaXN0XHJcblx0XHRcdEBzaG93V29yZENsb3VkKClcclxuXHJcblx0c2hvd1dvcmRDbG91ZDogKCkgLT5cclxuXHRcdGlmIGRhdGFfY2VudGVyLmZsaXN0ID09IG51bGwgb3IgdHlwZW9mIGRhdGFfY2VudGVyLmZsaXN0ID09ICd1bmRlZmluZWQnXHJcblx0XHRcdGNvbnNvbGUubG9nKCdub3Qgb2snKVxyXG5cdFx0XHRyZXR1cm5cclxuXHRcdGVsc2UgXHJcblx0XHRcdGRyYXcgPSAod29yZHMpIC0+XHJcblx0XHRcdFx0Y29uc29sZS5sb2coJ3RvIGRyYXcnKVxyXG5cdFx0XHRcdGQzLnNlbGVjdChcIiN3b3JkLWNsb3VkLWNvbnRhaW5lclwiKS5hcHBlbmQoXCJzdmdcIilcclxuXHRcdFx0XHRcdFx0LmF0dHIoXCJ3aWR0aFwiLCAxMjAwKVxyXG5cdFx0XHRcdFx0XHQuYXR0cihcImhlaWdodFwiLCA4MDApXHJcblx0XHRcdFx0XHQuYXBwZW5kKFwiZ1wiKVxyXG5cdFx0XHRcdFx0XHQuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSg1MDAsNTAwKVwiKVxyXG5cdFx0XHRcdFx0LnNlbGVjdEFsbChcInRleHRcIilcclxuXHRcdFx0XHRcdFx0LmRhdGEod29yZHMpXHJcblx0XHRcdFx0XHQuZW50ZXIoKS5hcHBlbmQoXCJ0ZXh0XCIpXHJcblx0XHRcdFx0XHRcdC5zdHlsZShcImZvbnQtc2l6ZVwiLCAoZCkgLT4gcmV0dXJuIGQuc2l6ZSArIFwicHhcIiApXHJcblx0XHRcdFx0XHRcdC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcclxuXHRcdFx0XHRcdFx0LmF0dHIoXCJ0cmFuc2Zvcm1cIiwgKGQpIC0+XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFwidHJhbnNsYXRlKFwiICsgW2QueCwgZC55XSArIFwiKXJvdGF0ZShcIiArIGQucm90YXRlICsgXCIpXCJcclxuXHRcdFx0XHRcdFx0KVxyXG5cdFx0XHRcdFx0XHQudGV4dCgoZCkgLT4gcmV0dXJuIGQudGV4dCApXHJcblx0XHRcdGNvbnNvbGUubG9nKCdvaycpXHJcblx0XHRcdHJ4ID0gWy4xLCAuMSwgLjEsIC4yLCAuOSwgLjcsIC43LCAuOSwgLjldXHJcblx0XHRcdHJ5ID0gWy4xLCAuMSwgLjIsIC4xLCAuOSwgLjcsIC43LCAuNywgLjddXHJcblx0XHRcdGZvbnRfc2l6ZSA9IFs2OSwgNTAsIDEwOSwgMTA0LCA5MywgNzgsIDc2LCA3MywgNzBdXHJcblx0XHRcdGQzLmxheW91dC5jbG91ZCgpLnNpemUoWzEwMDAsIDEwMDBdKVxyXG5cdFx0XHRcdFx0LndvcmRzKFtcclxuXHRcdFx0XHRcdFx0XCJIZWxsb1wiLCBcIndvcmxkXCIsIFwibm9ybWFsbHlcIiwgXCJ5b3VcIiwgXCJ3YW50XCIsIFwibW9yZVwiLCBcIndvcmRzXCIsXHJcblx0XHRcdFx0XHRcdFwidGhhblwiLCBcInRoaXNcIl0ubWFwKChkLCBpKSAtPlxyXG5cdFx0XHRcdFx0XHRyZXR1cm4ge3RleHQ6IGQsIHNpemU6IGZvbnRfc2l6ZVtpXSwgb3JpZ2luX3g6IHJ4W2ldLCBvcmlnaW5feTogcnlbaV19XHJcblx0XHRcdFx0XHQpKVxyXG5cdFx0XHRcdFx0LnJvdGF0ZSgoKSAtPiByZXR1cm4gfn4oTWF0aC5yYW5kb20oKSAqIDIpICogMzYwIClcclxuXHRcdFx0XHRcdC5mb250U2l6ZSgoZCkgLT4gcmV0dXJuIGQuc2l6ZSApXHJcblx0XHRcdFx0XHQub24oXCJlbmRcIiwgZHJhdylcclxuXHRcdFx0XHRcdC5zdGFydCgpXHJcblxyXG5cdFx0XHRcclxuXHRnZXRWYWw6IChvYmosIGRlZmF1bHRzKSAtPlxyXG5cdFx0cmV0dXJuIGlmIG9iaj8gdGhlbiBvYmogZWxzZSBkZWZhdWx0c1xyXG5cclxuXHRzaG93OiAoKSAtPlxyXG5cdFx0QGRlZmF1bHRzLmNvbnRhaW5lci5zaG93KClcclxuXHRcdEB1cGRhdGUoKVxyXG5cdFx0XHJcblxyXG5cdGhpZGU6ICgpIC0+XHJcblx0XHRAZGVmYXVsdHMuY29udGFpbmVyLmhpZGUoKVxyXG5cclxuXHJcblxyXG5cclxub3B0aW9ucyA9IFxyXG5cdG5hbWU6ICdjanMnXHJcblx0Y29udGFpbmVyOiAkKCcudWkuZ3JpZC5maW5hbmNlIC5vbGl2ZS50d2VsdmUud2lkZS5jb2x1bW4gLmZpbmFuY2UtdGFibGUnKVxyXG5cdGV2ZW50YnVzOiBldmVudGJ1c1xyXG5cclxuX2ZsaXN0ID0gbmV3IEZsaXN0KG9wdGlvbnMpXHJcblxyXG5cclxuY29zdF9vcHRpb25zID0gXHJcblx0Y29udGFpbmVyOiAkKCcudWkuZ3JpZC5maW5hbmNlIC5vbGl2ZS50d2VsdmUud2lkZS5jb2x1bW4gLmNvc3QtY2hhcnQnKVxyXG5fY29zdCA9IG5ldyBDb3N0Q2hhcnRTaG93KGNvc3Rfb3B0aW9ucylcclxuXHJcbnJhbmdlX29wdGlvbnMgPSBcclxuXHRjb250YWluZXI6ICQoJy51aS5ncmlkLmZpbmFuY2UgLm9saXZlLnR3ZWx2ZS53aWRlLmNvbHVtbiAucmFuZ2UtY2hhcnQnKVxyXG5fcmFuZ2UgPSBuZXcgUmFuZ2VDaGFydFNob3cocmFuZ2Vfb3B0aW9ucylcclxuXHJcbndvcmRfb3B0aW9ucyA9IFxyXG5cdGNvbnRhaW5lcjogJCgnLnVpLmdyaWQuZmluYW5jZSAub2xpdmUudHdlbHZlLndpZGUuY29sdW1uIC53b3JkLWNsb3VkJylcclxuX3dvcmRfY2xvdWQgPSBuZXcgV29yZENsb3VkKHdvcmRfb3B0aW9ucylcclxuXHJcblxyXG5cclxuIyDovrnmoI/kuovku7bnm5HlkKxcclxuIyDmmL7npLrmtojotLnliJfooahcclxuJCgnI2ZpbmFuY2UtbGlzdCcpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdGNvbnNvbGUubG9nICd0byBzaG93IGZpbmFuY2UtbGlzdCdcdFxyXG5cdF9mbGlzdC5zaG93KClcclxuXHRfY29zdC5oaWRlKClcclxuXHRfcmFuZ2UuaGlkZSgpXHJcblx0X3dvcmRfY2xvdWQuaGlkZSgpXHJcblxyXG4kKCcjZmluYW5jZS1jb3N0Jykub24gJ2NsaWNrJywgKGUpIC0+XHJcblx0Y29uc29sZS5sb2cgJ3RvIHNob3cgY29zdCBhcmVhJ1xyXG5cdF9mbGlzdC5oaWRlKClcclxuXHRfY29zdC5zaG93KClcclxuXHRfcmFuZ2UuaGlkZSgpXHJcblx0X3dvcmRfY2xvdWQuaGlkZSgpXHJcblxyXG4kKCcjZmluYW5jZS10eXBlJykub24gJ2NsaWNrJywgKGUpIC0+XHJcblx0Y29uc29sZS5sb2cgJ3RvIHNob3cgdHlwZSdcclxuXHRfZmxpc3QuaGlkZSgpXHJcblx0X2Nvc3QuaGlkZSgpXHJcblx0X3JhbmdlLnNob3coKVxyXG5cdF93b3JkX2Nsb3VkLmhpZGUoKVxyXG4kKCcjZDMtY2xvdWQnKS5vbiAnY2xpY2snLCAoZSkgLT5cclxuXHRjb25zb2xlLmxvZyAndG8gc2hvdyB3b3JkLWNsb3VkJ1xyXG5cdF9mbGlzdC5oaWRlKClcclxuXHRfY29zdC5oaWRlKClcclxuXHRfcmFuZ2UuaGlkZSgpXHJcblx0X3dvcmRfY2xvdWQuc2hvdygpXHJcbiJdfQ==
