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
var EventEmitter, FListTable, Flist, _flist, eventbus, options,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

EventEmitter = require('../../lib/eventemitter2/eventemitter2').EventEmitter2;

eventbus = require('../../own_modules/eventbus/eventbus');

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
    var context;
    context = this;
    console.log('Flist: dataChange:', data);
    return setTimeout(function() {
      console.log('to emit ');
      return context.defaults.f_list_table.emit('FListTable:dataChange', {});
    }, 5000);
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
    return has_data;
  };


  /**
  	 * 返回obj的值，不存在则返回defaults
  	 * @param  {obj} obj      对象的属性值
  	 * @param  {obj} defaults 默认值
  	 * @return {obj}          返回值
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
    table_html = "<div class=\"ui inverted segment\">\n	<button class=\"ui inverted yellow button\" id=\"edit-flist\" value=\"Save\">Edit</button>\n	<button class=\"ui inverted red button\" id=\"add-flist\">New</button>\n\n	<table class=\"ui selectable inverted table\">\n		<thead>\n			<tr>\n				<th>date</th>\n				<th>cost</th>\n				<th class=\"left aligned\">type</th>\n			</tr>\n		</thead>\n		<tbody>\n		</tbody>\n	</table>\n</div>";
    table = $(table_html);
    this.defaults.container.append(table);
    this.defaults.table = table;
    context = this;
    return table.find('#edit-flist').on('click', function(e) {
      var costInput, typeInput;
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
        return $('.type-item').on('click', typeInput);
      } else {
        $('.time-item').datetimepicker('destroy');
        $.each($('.cost-item'), function(i, e) {
          var $input, new_val, reg;
          $input = $(this).find('input');
          if ($input.length !== 0) {
            new_val = $(this).attr('val');
            console.log($(this), $(this).attr('val'));
            reg = /^[a-zA-Z0-9\u4e00-\u9fa5 ]+$/;
            if (reg.test(new_val) === true) {
              console.log('true while test the reg:', new_val);
              return $(this).html($input.attr('value'));
            } else {
              console.log(new_val, ' is false while test the reg');
              return $(this).html($(this).attr('val'));
            }
          }
        });
        console.log('defaults:', context.defaults);
        return context.defaults.flist.emit('FList:dataChange', context.defaults.datas);
      }
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
    items_html = '';
    $.each(datas.flist, function(i, e) {
      var cost_, date_, item_html, type_;
      date_ = e.date.slice(0, 10);
      cost_ = e.number;
      type_ = e.tag_arr.join(' ');
      item_html = "<tr>\n	<td class=\"time-item\">" + date_ + "</td>\n	<td class=\"cost-item\">" + cost_ + "</td>\n	<td class=\"type-item\">" + type_ + "</td>\n</tr>";
      return items_html += item_html;
    });
    return this.defaults.table.find('tbody').html(items_html);
  };

  return FListTable;

})(EventEmitter);

options = {
  name: 'cjs',
  container: $('.ui.grid.finance .olive.twelve.wide.column'),
  eventbus: eventbus
};

_flist = new Flist(options);



},{"../../lib/eventemitter2/eventemitter2":1,"../../own_modules/eventbus/eventbus":2}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOi9jaGVuanNoMzYvbXlkZXZlbG9wL25vZGUvbmV3ZXhwcmVzc182L3dlYmZlL2xpYi9ldmVudGVtaXR0ZXIyL2V2ZW50ZW1pdHRlcjIuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXG93bl9tb2R1bGVzXFxldmVudGJ1c1xcZXZlbnRidXMuY29mZmVlIiwiRTpcXGNoZW5qc2gzNlxcbXlkZXZlbG9wXFxub2RlXFxuZXdleHByZXNzXzZcXHdlYmZlXFxwYWdlc1xcZmxpc3RcXGZsaXN0LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JsQkEsSUFBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLHlDQUFSLENBQWtELENBQUM7O0FBQ2xFLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLElBQUk7Ozs7O0FDRHJCLElBQUEsMERBQUE7RUFBQTs7O0FBQUEsWUFBQSxHQUFlLE9BQUEsQ0FBUSx1Q0FBUixDQUFn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TUFDVixLQUFBLEdBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFWLENBQWUsR0FBZjtNQUNSLFNBQUEsR0FBWSxpQ0FBQSxHQUVjLEtBRmQsR0FFb0Isa0NBRnBCLEdBR2MsS0FIZCxHQUdvQixrQ0FIcEIsR0FJYyxLQUpkLEdBSW9CO2FBR2hDLFVBQUEsSUFBYztJQVhLLENBQXBCO1dBWUEsSUFBQyxDQUFBLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBaEIsQ0FBcUIsT0FBckIsQ0FBNkIsQ0FBQyxJQUE5QixDQUFtQyxVQUFuQztFQWhCTzs7OztHQXhHZ0I7O0FBMkh6QixPQUFBLEdBQ0M7RUFBQSxJQUFBLEVBQU0sS0FBTjtFQUNBLFNBQUEsRUFBVyxDQUFBLENBQUUsNENBQUYsQ0FEWDtFQUVBLFFBQUEsRUFBVSxRQUZWOzs7QUFJRCxNQUFBLEdBQWEsSUFBQSxLQUFBLENBQU0sT0FBTiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiFcclxuICogRXZlbnRFbWl0dGVyMlxyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vaGlqMW54L0V2ZW50RW1pdHRlcjJcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDEzIGhpajFueFxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXHJcbiAqL1xyXG47IWZ1bmN0aW9uKHVuZGVmaW5lZCkge1xyXG5cclxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgPyBBcnJheS5pc0FycmF5IDogZnVuY3Rpb24gX2lzQXJyYXkob2JqKSB7XHJcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcclxuICB9O1xyXG4gIHZhciBkZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XHJcblxyXG4gIGZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcclxuICAgIGlmICh0aGlzLl9jb25mKSB7XHJcbiAgICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIHRoaXMuX2NvbmYpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gY29uZmlndXJlKGNvbmYpIHtcclxuICAgIGlmIChjb25mKSB7XHJcblxyXG4gICAgICB0aGlzLl9jb25mID0gY29uZjtcclxuXHJcbiAgICAgIGNvbmYuZGVsaW1pdGVyICYmICh0aGlzLmRlbGltaXRlciA9IGNvbmYuZGVsaW1pdGVyKTtcclxuICAgICAgY29uZi5tYXhMaXN0ZW5lcnMgJiYgKHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBjb25mLm1heExpc3RlbmVycyk7XHJcbiAgICAgIGNvbmYud2lsZGNhcmQgJiYgKHRoaXMud2lsZGNhcmQgPSBjb25mLndpbGRjYXJkKTtcclxuICAgICAgY29uZi5uZXdMaXN0ZW5lciAmJiAodGhpcy5uZXdMaXN0ZW5lciA9IGNvbmYubmV3TGlzdGVuZXIpO1xyXG5cclxuICAgICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICB0aGlzLmxpc3RlbmVyVHJlZSA9IHt9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBFdmVudEVtaXR0ZXIoY29uZikge1xyXG4gICAgdGhpcy5fZXZlbnRzID0ge307XHJcbiAgICB0aGlzLm5ld0xpc3RlbmVyID0gZmFsc2U7XHJcbiAgICBjb25maWd1cmUuY2FsbCh0aGlzLCBjb25mKTtcclxuICB9XHJcblxyXG4gIC8vXHJcbiAgLy8gQXR0ZW50aW9uLCBmdW5jdGlvbiByZXR1cm4gdHlwZSBub3cgaXMgYXJyYXksIGFsd2F5cyAhXHJcbiAgLy8gSXQgaGFzIHplcm8gZWxlbWVudHMgaWYgbm8gYW55IG1hdGNoZXMgZm91bmQgYW5kIG9uZSBvciBtb3JlXHJcbiAgLy8gZWxlbWVudHMgKGxlYWZzKSBpZiB0aGVyZSBhcmUgbWF0Y2hlc1xyXG4gIC8vXHJcbiAgZnVuY3Rpb24gc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCBpKSB7XHJcbiAgICBpZiAoIXRyZWUpIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gICAgdmFyIGxpc3RlbmVycz1bXSwgbGVhZiwgbGVuLCBicmFuY2gsIHhUcmVlLCB4eFRyZWUsIGlzb2xhdGVkQnJhbmNoLCBlbmRSZWFjaGVkLFxyXG4gICAgICAgIHR5cGVMZW5ndGggPSB0eXBlLmxlbmd0aCwgY3VycmVudFR5cGUgPSB0eXBlW2ldLCBuZXh0VHlwZSA9IHR5cGVbaSsxXTtcclxuICAgIGlmIChpID09PSB0eXBlTGVuZ3RoICYmIHRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAvL1xyXG4gICAgICAvLyBJZiBhdCB0aGUgZW5kIG9mIHRoZSBldmVudChzKSBsaXN0IGFuZCB0aGUgdHJlZSBoYXMgbGlzdGVuZXJzXHJcbiAgICAgIC8vIGludm9rZSB0aG9zZSBsaXN0ZW5lcnMuXHJcbiAgICAgIC8vXHJcbiAgICAgIGlmICh0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnMpO1xyXG4gICAgICAgIHJldHVybiBbdHJlZV07XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm9yIChsZWFmID0gMCwgbGVuID0gdHJlZS5fbGlzdGVuZXJzLmxlbmd0aDsgbGVhZiA8IGxlbjsgbGVhZisrKSB7XHJcbiAgICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVyc1tsZWFmXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBbdHJlZV07XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoKGN1cnJlbnRUeXBlID09PSAnKicgfHwgY3VycmVudFR5cGUgPT09ICcqKicpIHx8IHRyZWVbY3VycmVudFR5cGVdKSB7XHJcbiAgICAgIC8vXHJcbiAgICAgIC8vIElmIHRoZSBldmVudCBlbWl0dGVkIGlzICcqJyBhdCB0aGlzIHBhcnRcclxuICAgICAgLy8gb3IgdGhlcmUgaXMgYSBjb25jcmV0ZSBtYXRjaCBhdCB0aGlzIHBhdGNoXHJcbiAgICAgIC8vXHJcbiAgICAgIGlmIChjdXJyZW50VHlwZSA9PT0gJyonKSB7XHJcbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xyXG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xyXG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzEpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcclxuICAgICAgfSBlbHNlIGlmKGN1cnJlbnRUeXBlID09PSAnKionKSB7XHJcbiAgICAgICAgZW5kUmVhY2hlZCA9IChpKzEgPT09IHR5cGVMZW5ndGggfHwgKGkrMiA9PT0gdHlwZUxlbmd0aCAmJiBuZXh0VHlwZSA9PT0gJyonKSk7XHJcbiAgICAgICAgaWYoZW5kUmVhY2hlZCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAgIC8vIFRoZSBuZXh0IGVsZW1lbnQgaGFzIGEgX2xpc3RlbmVycywgYWRkIGl0IHRvIHRoZSBoYW5kbGVycy5cclxuICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCB0eXBlTGVuZ3RoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XHJcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XHJcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gJyonIHx8IGJyYW5jaCA9PT0gJyoqJykge1xyXG4gICAgICAgICAgICAgIGlmKHRyZWVbYnJhbmNoXS5fbGlzdGVuZXJzICYmICFlbmRSZWFjaGVkKSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCB0eXBlTGVuZ3RoKSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcclxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzIpKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAvLyBObyBtYXRjaCBvbiB0aGlzIG9uZSwgc2hpZnQgaW50byB0aGUgdHJlZSBidXQgbm90IGluIHRoZSB0eXBlIGFycmF5LlxyXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVtjdXJyZW50VHlwZV0sIGkrMSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHhUcmVlID0gdHJlZVsnKiddO1xyXG4gICAgaWYgKHhUcmVlKSB7XHJcbiAgICAgIC8vXHJcbiAgICAgIC8vIElmIHRoZSBsaXN0ZW5lciB0cmVlIHdpbGwgYWxsb3cgYW55IG1hdGNoIGZvciB0aGlzIHBhcnQsXHJcbiAgICAgIC8vIHRoZW4gcmVjdXJzaXZlbHkgZXhwbG9yZSBhbGwgYnJhbmNoZXMgb2YgdGhlIHRyZWVcclxuICAgICAgLy9cclxuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4VHJlZSwgaSsxKTtcclxuICAgIH1cclxuXHJcbiAgICB4eFRyZWUgPSB0cmVlWycqKiddO1xyXG4gICAgaWYoeHhUcmVlKSB7XHJcbiAgICAgIGlmKGkgPCB0eXBlTGVuZ3RoKSB7XHJcbiAgICAgICAgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAgIC8vIElmIHdlIGhhdmUgYSBsaXN0ZW5lciBvbiBhICcqKicsIGl0IHdpbGwgY2F0Y2ggYWxsLCBzbyBhZGQgaXRzIGhhbmRsZXIuXHJcbiAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBCdWlsZCBhcnJheXMgb2YgbWF0Y2hpbmcgbmV4dCBicmFuY2hlcyBhbmQgb3RoZXJzLlxyXG4gICAgICAgIGZvcihicmFuY2ggaW4geHhUcmVlKSB7XHJcbiAgICAgICAgICBpZihicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB4eFRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xyXG4gICAgICAgICAgICBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XHJcbiAgICAgICAgICAgICAgLy8gV2Uga25vdyB0aGUgbmV4dCBlbGVtZW50IHdpbGwgbWF0Y2gsIHNvIGp1bXAgdHdpY2UuXHJcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsyKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gY3VycmVudFR5cGUpIHtcclxuICAgICAgICAgICAgICAvLyBDdXJyZW50IG5vZGUgbWF0Y2hlcywgbW92ZSBpbnRvIHRoZSB0cmVlLlxyXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2ggPSB7fTtcclxuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaFticmFuY2hdID0geHhUcmVlW2JyYW5jaF07XHJcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB7ICcqKic6IGlzb2xhdGVkQnJhbmNoIH0sIGkrMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZih4eFRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgIC8vIFdlIGhhdmUgcmVhY2hlZCB0aGUgZW5kIGFuZCBzdGlsbCBvbiBhICcqKidcclxuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XHJcbiAgICAgIH0gZWxzZSBpZih4eFRyZWVbJyonXSAmJiB4eFRyZWVbJyonXS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbJyonXSwgdHlwZUxlbmd0aCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbGlzdGVuZXJzO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gZ3Jvd0xpc3RlbmVyVHJlZSh0eXBlLCBsaXN0ZW5lcikge1xyXG5cclxuICAgIHR5cGUgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuXHJcbiAgICAvL1xyXG4gICAgLy8gTG9va3MgZm9yIHR3byBjb25zZWN1dGl2ZSAnKionLCBpZiBzbywgZG9uJ3QgYWRkIHRoZSBldmVudCBhdCBhbGwuXHJcbiAgICAvL1xyXG4gICAgZm9yKHZhciBpID0gMCwgbGVuID0gdHlwZS5sZW5ndGg7IGkrMSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIGlmKHR5cGVbaV0gPT09ICcqKicgJiYgdHlwZVtpKzFdID09PSAnKionKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRyZWUgPSB0aGlzLmxpc3RlbmVyVHJlZTtcclxuICAgIHZhciBuYW1lID0gdHlwZS5zaGlmdCgpO1xyXG5cclxuICAgIHdoaWxlIChuYW1lKSB7XHJcblxyXG4gICAgICBpZiAoIXRyZWVbbmFtZV0pIHtcclxuICAgICAgICB0cmVlW25hbWVdID0ge307XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRyZWUgPSB0cmVlW25hbWVdO1xyXG5cclxuICAgICAgaWYgKHR5cGUubGVuZ3RoID09PSAwKSB7XHJcblxyXG4gICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBsaXN0ZW5lcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZih0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBbdHJlZS5fbGlzdGVuZXJzLCBsaXN0ZW5lcl07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKGlzQXJyYXkodHJlZS5fbGlzdGVuZXJzKSkge1xyXG5cclxuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcclxuXHJcbiAgICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycy53YXJuZWQpIHtcclxuXHJcbiAgICAgICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcclxuXHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKG0gPiAwICYmIHRyZWUuX2xpc3RlbmVycy5sZW5ndGggPiBtKSB7XHJcblxyXG4gICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy53YXJuZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5sZW5ndGgpO1xyXG4gICAgICAgICAgICAgIGlmKGNvbnNvbGUudHJhY2Upe1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgICBuYW1lID0gdHlwZS5zaGlmdCgpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuXHJcbiAgLy8gMTAgbGlzdGVuZXJzIGFyZSBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoXHJcbiAgLy8gaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXHJcbiAgLy9cclxuICAvLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3NcclxuICAvLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5kZWxpbWl0ZXIgPSAnLic7XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xyXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuICAgIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBuO1xyXG4gICAgaWYgKCF0aGlzLl9jb25mKSB0aGlzLl9jb25mID0ge307XHJcbiAgICB0aGlzLl9jb25mLm1heExpc3RlbmVycyA9IG47XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5ldmVudCA9ICcnO1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pIHtcclxuICAgIHRoaXMubWFueShldmVudCwgMSwgZm4pO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5tYW55ID0gZnVuY3Rpb24oZXZlbnQsIHR0bCwgZm4pIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignbWFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbGlzdGVuZXIoKSB7XHJcbiAgICAgIGlmICgtLXR0bCA9PT0gMCkge1xyXG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgIH1cclxuICAgICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBsaXN0ZW5lci5fb3JpZ2luID0gZm47XHJcblxyXG4gICAgdGhpcy5vbihldmVudCwgbGlzdGVuZXIpO1xyXG5cclxuICAgIHJldHVybiBzZWxmO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgdmFyIHR5cGUgPSBhcmd1bWVudHNbMF07XHJcblxyXG4gICAgaWYgKHR5cGUgPT09ICduZXdMaXN0ZW5lcicgJiYgIXRoaXMubmV3TGlzdGVuZXIpIHtcclxuICAgICAgaWYgKCF0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpIHsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSAqX2FsbCogZnVuY3Rpb25zIGFuZCBpbnZva2UgdGhlbS5cclxuICAgIGlmICh0aGlzLl9hbGwpIHtcclxuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xyXG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XHJcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMuX2FsbC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcclxuICAgICAgICB0aGlzLl9hbGxbaV0uYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXHJcbiAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xyXG5cclxuICAgICAgaWYgKCF0aGlzLl9hbGwgJiZcclxuICAgICAgICAhdGhpcy5fZXZlbnRzLmVycm9yICYmXHJcbiAgICAgICAgISh0aGlzLndpbGRjYXJkICYmIHRoaXMubGlzdGVuZXJUcmVlLmVycm9yKSkge1xyXG5cclxuICAgICAgICBpZiAoYXJndW1lbnRzWzFdIGluc3RhbmNlb2YgRXJyb3IpIHtcclxuICAgICAgICAgIHRocm93IGFyZ3VtZW50c1sxXTsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5jYXVnaHQsIHVuc3BlY2lmaWVkICdlcnJvcicgZXZlbnQuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB2YXIgaGFuZGxlcjtcclxuXHJcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIGhhbmRsZXIgPSBbXTtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXIsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XHJcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKVxyXG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgLy8gc2xvd2VyXHJcbiAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XHJcbiAgICAgICAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChoYW5kbGVyKSB7XHJcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcclxuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xyXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XHJcblxyXG4gICAgICB2YXIgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xyXG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcclxuICAgICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIChsaXN0ZW5lcnMubGVuZ3RoID4gMCkgfHwgISF0aGlzLl9hbGw7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgcmV0dXJuICEhdGhpcy5fYWxsO1xyXG4gICAgfVxyXG5cclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcclxuXHJcbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhpcy5vbkFueSh0eXBlKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uIG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcclxuICAgIH1cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PSBcIm5ld0xpc3RlbmVyc1wiISBCZWZvcmVcclxuICAgIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJzXCIuXHJcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xyXG5cclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgZ3Jvd0xpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIHR5cGUsIGxpc3RlbmVyKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHtcclxuICAgICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXHJcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZih0eXBlb2YgdGhpcy5fZXZlbnRzW3R5cGVdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcclxuICAgICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XHJcblxyXG4gICAgICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xyXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcclxuXHJcbiAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xyXG5cclxuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XHJcbiAgICAgICAgICBpZihjb25zb2xlLnRyYWNlKXtcclxuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbkFueSA9IGZ1bmN0aW9uKGZuKSB7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uQW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcclxuICAgIH1cclxuXHJcbiAgICBpZighdGhpcy5fYWxsKSB7XHJcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCB0aGUgZnVuY3Rpb24gdG8gdGhlIGV2ZW50IGxpc3RlbmVyIGNvbGxlY3Rpb24uXHJcbiAgICB0aGlzLl9hbGwucHVzaChmbik7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbjtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xyXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlbW92ZUxpc3RlbmVyIG9ubHkgdGFrZXMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGhhbmRsZXJzLGxlYWZzPVtdO1xyXG5cclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAvLyBkb2VzIG5vdCB1c2UgbGlzdGVuZXJzKCksIHNvIG5vIHNpZGUgZWZmZWN0IG9mIGNyZWF0aW5nIF9ldmVudHNbdHlwZV1cclxuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xyXG4gICAgICBoYW5kbGVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgICAgbGVhZnMucHVzaCh7X2xpc3RlbmVyczpoYW5kbGVyc30pO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xyXG4gICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcclxuICAgICAgaGFuZGxlcnMgPSBsZWFmLl9saXN0ZW5lcnM7XHJcbiAgICAgIGlmIChpc0FycmF5KGhhbmRsZXJzKSkge1xyXG5cclxuICAgICAgICB2YXIgcG9zaXRpb24gPSAtMTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGhhbmRsZXJzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBpZiAoaGFuZGxlcnNbaV0gPT09IGxpc3RlbmVyIHx8XHJcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5saXN0ZW5lciAmJiBoYW5kbGVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XHJcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5fb3JpZ2luICYmIGhhbmRsZXJzW2ldLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xyXG4gICAgICAgICAgICBwb3NpdGlvbiA9IGk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHBvc2l0aW9uIDwgMCkge1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgICAgICBsZWFmLl9saXN0ZW5lcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0uc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChoYW5kbGVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgfVxyXG4gICAgICBlbHNlIGlmIChoYW5kbGVycyA9PT0gbGlzdGVuZXIgfHxcclxuICAgICAgICAoaGFuZGxlcnMubGlzdGVuZXIgJiYgaGFuZGxlcnMubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxyXG4gICAgICAgIChoYW5kbGVycy5fb3JpZ2luICYmIGhhbmRsZXJzLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xyXG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZWN1cnNpdmVseUdhcmJhZ2VDb2xsZWN0KHJvb3QpIHtcclxuICAgICAgaWYgKHJvb3QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHJvb3QpO1xyXG4gICAgICBmb3IgKHZhciBpIGluIGtleXMpIHtcclxuICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcclxuICAgICAgICB2YXIgb2JqID0gcm9vdFtrZXldO1xyXG4gICAgICAgIGlmICgob2JqIGluc3RhbmNlb2YgRnVuY3Rpb24pIHx8ICh0eXBlb2Ygb2JqICE9PSBcIm9iamVjdFwiKSlcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHJlY3Vyc2l2ZWx5R2FyYmFnZUNvbGxlY3Qocm9vdFtrZXldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICBkZWxldGUgcm9vdFtrZXldO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmVjdXJzaXZlbHlHYXJiYWdlQ29sbGVjdCh0aGlzLmxpc3RlbmVyVHJlZSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmZBbnkgPSBmdW5jdGlvbihmbikge1xyXG4gICAgdmFyIGkgPSAwLCBsID0gMCwgZm5zO1xyXG4gICAgaWYgKGZuICYmIHRoaXMuX2FsbCAmJiB0aGlzLl9hbGwubGVuZ3RoID4gMCkge1xyXG4gICAgICBmbnMgPSB0aGlzLl9hbGw7XHJcbiAgICAgIGZvcihpID0gMCwgbCA9IGZucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZihmbiA9PT0gZm5zW2ldKSB7XHJcbiAgICAgICAgICBmbnMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9hbGwgPSBbXTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZjtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAhdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuICAgICAgdmFyIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuXHJcbiAgICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xyXG4gICAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xyXG4gICAgICAgIGxlYWYuX2xpc3RlbmVycyA9IG51bGw7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbnVsbDtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xyXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICB2YXIgaGFuZGxlcnMgPSBbXTtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXJzLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xyXG4gICAgICByZXR1cm4gaGFuZGxlcnM7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuXHJcbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgdGhpcy5fZXZlbnRzW3R5cGVdID0gW107XHJcbiAgICBpZiAoIWlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLl9ldmVudHNbdHlwZV07XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnNBbnkgPSBmdW5jdGlvbigpIHtcclxuXHJcbiAgICBpZih0aGlzLl9hbGwpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2FsbDtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcblxyXG4gIH07XHJcblxyXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcclxuICAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICAgIHJldHVybiBFdmVudEVtaXR0ZXI7XHJcbiAgICB9KTtcclxuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xyXG4gICAgLy8gQ29tbW9uSlNcclxuICAgIGV4cG9ydHMuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcclxuICB9IGVsc2Uge1xyXG4gICAgLy8gQnJvd3NlciBnbG9iYWwuXHJcbiAgICB3aW5kb3cuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcclxuICB9XHJcbiAgbW9kdWxlLmV4cG9ydHMuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcclxufSgpO1xyXG4iLCJFVkVOVEVNSVRURVIgPSByZXF1aXJlKCcuLy4uLy4uL2xpYi9ldmVudGVtaXR0ZXIyL2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyXHJcbm1vZHVsZS5leHBvcnRzID0gbmV3IEVWRU5URU1JVFRFUjsiLCJFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi8uLi9saWIvZXZlbnRlbWl0dGVyMi9ldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMlxyXG5ldmVudGJ1cyA9IHJlcXVpcmUoJy4uLy4uL293bl9tb2R1bGVzL2V2ZW50YnVzL2V2ZW50YnVzJylcclxuIyBQYWdlVmlzaWJpbGl0eSA9IHJlcXVpcmUoJy4uLy4uL293bl9tb2R1bGVzL1BhZ2VWaXNpYmlsaXR5JylcclxuXHJcbiMgc3RhdHVzQ2hhbmdlID0gKGUpIC0+XHJcbiMgXHRjb25zb2xlLmxvZyBuZXcgRGF0ZSgpXHJcbiMgXHRjb25zb2xlLmxvZyBlXHJcbiMgXHRjb25zb2xlLmxvZyBAaGlkZGVuXHJcbiMgXHRjb25zb2xlLmxvZyBAdmlzaWJpbGl0eXN0YXRlXHJcblxyXG4jIFBhZ2VWaXNpYmlsaXR5LnZpc2liaWxpdHljaGFuZ2Uoc3RhdHVzQ2hhbmdlKVxyXG5cclxuIyAkLmFqYXgoe1xyXG4jIFx0dHlwZTogJ2dldCdcclxuIyBcdGRhdGFUeXBlOiAnanNvbidcclxuIyBcdHVybDogJy9nZXRMaXN0J1xyXG4jIFx0c3VjY2VzczogKGRhdGEpIC0+XHJcbiMgXHRcdGNvbnNvbGUubG9nIGRhdGFcclxuIyBcdGVycm9yOiAoZGF0YSkgLT5cclxuIyBcdFx0Y29uc29sZS5sb2cgJ0Vycm9yJywgZGF0YVxyXG5cclxuIyB9KVxyXG5jbGFzcyBGbGlzdCBleHRlbmRzIEV2ZW50RW1pdHRlclxyXG5cdGNvbnN0cnVjdG9yOiAob3B0aW9ucyktPlxyXG5cdFx0IyBzdXBlci5hcHBseSBALCBhcmd1bWVudHNcclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHRAZGVmYXVsdHMgPSBcclxuXHRcdFx0bmFtZTogQGdldFZhbChvcHRpb25zLm5hbWUsICdjamonKVxyXG5cdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdFx0ZWxlbTogbnVsbFxyXG5cdFx0XHRmX2xpc3RfdGFibGU6IG5ldyBGTGlzdFRhYmxlKHtcclxuXHRcdFx0XHRjb250YWluZXI6IEBnZXRWYWwob3B0aW9ucy5jb250YWluZXIsICQoJ2JvZHknKSlcclxuXHRcdFx0XHRmbGlzdDogY29udGV4dFxyXG5cdFx0XHR9KSBcclxuXHRcdFx0ZXZlbnRidXM6IEBnZXRWYWwob3B0aW9ucy5ldmVudGJ1cywgbnVsbClcclxuXHRcdEBkYXRhcyA9IG51bGxcclxuXHJcblx0XHRALm9uICdGbGlzdDpyZXF1ZXN0JywgQHJlcXVlc3RcclxuXHRcdEBkZWZhdWx0cy5ldmVudGJ1cy5vbiAnRmxpc3Q6cmVxdWVzdCcsIEByZXF1ZXN0XHJcblxyXG5cdFx0QC5vbiAnRkxpc3Q6ZGF0YUNoYW5nZScsIEBkYXRhQ2hhbmdlXHJcblxyXG5cdFx0Y2FsbGJhY2tfID0gKGRhdGEpIC0+XHJcblx0XHRcdGNvbnRleHQuY2FsRGF0YShkYXRhKVxyXG5cdFx0XHRjb250ZXh0LnJlbmRlcigpXHJcblx0XHRldmVudGJ1cy5lbWl0ICdGbGlzdDpyZXF1ZXN0JywgY2FsbGJhY2tfXHJcblx0XHJcblx0IyMjKlxyXG5cdCAqIOabtOaWsOaVsOaNrlxyXG5cdCMjI1xyXG5cdGRhdGFDaGFuZ2U6IChkYXRhKSAtPlxyXG5cdFx0Y29udGV4dCA9IEBcclxuXHRcdGNvbnNvbGUubG9nICdGbGlzdDogZGF0YUNoYW5nZTonLCBkYXRhXHJcblx0XHRzZXRUaW1lb3V0KCgpLT5cclxuXHRcdFx0Y29uc29sZS5sb2cgJ3RvIGVtaXQgJ1xyXG5cdFx0XHRjb250ZXh0LmRlZmF1bHRzLmZfbGlzdF90YWJsZS5lbWl0ICdGTGlzdFRhYmxlOmRhdGFDaGFuZ2UnLCB7fVxyXG5cdFx0LCA1MDAwKVxyXG5cclxuXHQjIyMqXHJcblx0ICog5aSE55CG5pWw5o2uXHJcblx0ICogQHBhcmFtICB7b2JqfSBkYXRhIOacquWkhOeQhueahOWHveaVsFxyXG5cdCAqIEByZXR1cm4ge2Jvb2x9ICAgICAg5piv5ZCm5ZCr5pyJ5pWw5o2uXHJcblx0IyMjXHJcblx0Y2FsRGF0YTogKGRhdGEpIC0+XHJcblx0XHRoYXNfZGF0YSA9IHRydWVcclxuXHRcdGZsaXN0ID0gW11cclxuXHRcdGVyciA9ICcnXHJcblx0XHRpZiBkYXRhWydyZXRfY29kZSddPyBhbmQgcGFyc2VJbnQoZGF0YVsncmV0X2NvZGUnXSkgPT0gMjAwXHJcblx0XHRcdGlmIGRhdGFbJ2RhdGEnXT8gYW5kIGRhdGFbJ2RhdGEnXS5sZW5ndGggPiAwXHJcblx0XHRcdFx0JC5lYWNoIGRhdGFbJ2RhdGEnXSwgKGksIGUpIC0+XHJcblx0XHRcdFx0XHRmbGlzdC5wdXNoIHtcclxuXHRcdFx0XHRcdFx0aWQ6IGUuaWRcclxuXHRcdFx0XHRcdFx0YmVsb25nX2lkOiBlLmJlbG9uZ19pZFxyXG5cdFx0XHRcdFx0XHRkYXRlOiBlLmRhdGUgXHJcblx0XHRcdFx0XHRcdG51bWJlcjogZS5udW1iZXJcclxuXHRcdFx0XHRcdFx0dHlwZV9pZDogZS50eXBlX2lkXHJcblx0XHRcdFx0XHRcdHRhZ19hcnI6IGUudGFnX2FyclxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0Y29uc29sZS5sb2cgJ2RhdGEgbGVuZ3RoIGxlc3MgdGhlbiAwJ1xyXG5cdFx0XHRcdGhhc19kYXRhID0gZmFsc2VcclxuXHRcdGVsc2VcclxuXHRcdFx0Y29uc29sZS5sb2cgJ3JldF9jb2RlIG5vdCAyMDAnXHJcblx0XHRcdGhhc19kYXRhID0gZmFsc2VcclxuXHRcdFx0ZXJyID0gaWYgZGF0YVsnZXJyJ10/IHRoZW4gZGF0YVsnZXJyJ10gZWxzZSAnaHR0cCBzdGF0ZSBub3QgMjAwISdcclxuXHRcdEBkYXRhcyA9IFxyXG5cdFx0XHRoYXNfZGF0YTogaGFzX2RhdGFcclxuXHRcdFx0Zmxpc3Q6IGZsaXN0XHJcblx0XHRyZXR1cm4gaGFzX2RhdGFcclxuXHJcblx0IyMjKlxyXG5cdCAqIOi/lOWbnm9iaueahOWAvO+8jOS4jeWtmOWcqOWImei/lOWbnmRlZmF1bHRzXHJcblx0ICogQHBhcmFtICB7b2JqfSBvYmogICAgICDlr7nosaHnmoTlsZ7mgKflgLxcclxuXHQgKiBAcGFyYW0gIHtvYmp9IGRlZmF1bHRzIOm7mOiupOWAvFxyXG5cdCAqIEByZXR1cm4ge29ian0gICAgICAgICAg6L+U5Zue5YC8XHJcblx0IyMjXHJcblx0Z2V0VmFsOiAob2JqLCBkZWZhdWx0cykgLT5cclxuXHRcdHJldHVybiBpZiBvYmo/IHRoZW4gb2JqIGVsc2UgZGVmYXVsdHNcclxuXHRcclxuXHQjIGluaXRIdG1sOiAoKSAtPlxyXG5cdCMgXHRjX2h0bWxfID0gXCJcIlwiXHJcblx0IyBcdFx0PGRpdiBjbGFzcz1cIm9saXZlIHR3ZWx2ZSB3aWRlIGNvbHVtblwiPjwvZGl2PlxyXG5cdCMgXHRcIlwiXCJcclxuXHQjIFx0QGRlZmF1bHRzLmNvbnRhaW5lci5odG1sIGNfaHRtbF8gXHJcblxyXG5cdCMjIypcclxuXHQgKiDor7vlj5blr7nosaHnmoRkYXRhc+W5tua4suafk+WvueixoVxyXG5cdCAqIEByZXR1cm4ge29ian0g5b2T5YmN5a+56LGhXHJcblx0IyMjXHJcblx0cmVuZGVyOiAoKSAtPlxyXG5cdFx0aWYgQGRhdGFzLmhhc19kYXRhXHJcblx0XHRcdCMgZXZlbnRidXMuZW1pdCAnRkxpc3RUYWJsZTpyZW5kZXJEYXRhJywgQGRhdGFzXHJcblx0XHRcdEBkZWZhdWx0cy5mX2xpc3RfdGFibGUuZW1pdCAnRkxpc3RUYWJsZTpyZW5kZXJEYXRhJywgQGRhdGFzXHJcblx0XHRlbHNlXHJcblx0XHRcdGNvbnNvbGUubG9nICfmmoLml6DmlbDmja7vvIzor7fliJvlu7onXHRcclxuXHJcblx0IyMjKlxyXG5cdCAqIOivt+axgui0ouWKoeS/oeaBr+WIl+ihqFxyXG5cdCAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayDor7fmsYLlrozmiJDlkI7osIPnlKjnmoTlh73mlbBcclxuXHQgKiBAcmV0dXJuIHtudWxsfSAgICAgICAgICAgIG5vbmVcclxuXHQjIyNcclxuXHRyZXF1ZXN0OiAoY2FsbGJhY2spIC0+XHJcblx0XHQkLmFqYXgge1xyXG5cdFx0XHR0eXBlOiAnZ2V0J1xyXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nXHJcblx0XHRcdHVybDogJy9nZXRMaXN0J1xyXG5cdFx0XHRzdWNjZXNzOiAoZGF0YSkgLT5cclxuXHRcdFx0XHRjYWxsYmFjayhkYXRhKVxyXG5cdFx0XHRlcnJvcjogKGRhdGEpIC0+XHJcblx0XHRcdFx0Y29uc29sZS5sb2cgJ0Vycm9yJywgZGF0YVxyXG5cdFx0XHRcdGNhbGxiYWNrKGRhdGEpXHJcblx0XHRcdFx0XHJcblx0XHR9XHJcblxyXG4jIOi0ouWKoeihqOagvOaPkuS7tlxyXG4jIOiDveWkn+WinuWIoOW3ruaUuVxyXG5jbGFzcyBGTGlzdFRhYmxlIGV4dGVuZHMgRXZlbnRFbWl0dGVyXHJcblx0Y29uc3RydWN0b3I6IChvcHRpb25zKSAtPlxyXG5cdFx0Y29udGV4dCA9IEBcclxuXHRcdEBkZWZhdWx0cyA9IFxyXG5cdFx0XHRuYW1lOiAnRkxpc3RUYWJsZSdcclxuXHRcdFx0Y29udGFpbmVyOiBAZ2V0VmFsKG9wdGlvbnMuY29udGFpbmVyLCAkKCdib2R5JykpXHJcblx0XHRcdGV2ZW50YnVzOiBAZ2V0VmFsKG9wdGlvbnMuZXZlbnRidXMsIGV2ZW50YnVzKVxyXG5cdFx0XHR0YWJsZTogbnVsbFxyXG5cdFx0XHRkYXRhczogbnVsbFxyXG5cdFx0XHRmbGlzdDogQGdldFZhbChvcHRpb25zLmZsaXN0LCB7fSlcclxuXHRcdEAub24gJ0ZMaXN0VGFibGU6cmVuZGVyRGF0YScsIGNvbnRleHQucmVuZGVyXHJcblx0XHRAZGVmYXVsdHMuZXZlbnRidXMub24gJ0ZMaXN0VGFibGU6cmVuZGVyRGF0YScsIGNvbnRleHQucmVuZGVyXHJcblx0XHRcclxuXHRcdEAub24gJ0ZMaXN0VGFibGU6ZGF0YUNoYW5nZScsIGNvbnRleHQuZGF0YUNoYW5nZVxyXG5cdFx0QGluaXQoKVxyXG5cclxuXHRkYXRhQ2hhbmdlOiAocmVzKSAtPlxyXG5cdFx0Y29uc29sZS5sb2cgJ0ZMaXN0VGFibGU6ZGF0YWNoYW5nZSByZXM6ICcsIHJlc1xyXG5cdFx0JCgnI2VkaXQtZmxpc3QnKS50ZXh0KCdFZGl0JylcclxuXHRcdCQoJyNlZGl0LWZsaXN0JykuYXR0cigndmFsdWUnLCAnU2F2ZScpXHJcblxyXG5cdGluaXQ6ICgpIC0+XHJcblx0XHR0YWJsZV9odG1sID0gXCJcIlwiXHJcblx0XHRcdDxkaXYgY2xhc3M9XCJ1aSBpbnZlcnRlZCBzZWdtZW50XCI+XHJcblx0XHRcdFx0PGJ1dHRvbiBjbGFzcz1cInVpIGludmVydGVkIHllbGxvdyBidXR0b25cIiBpZD1cImVkaXQtZmxpc3RcIiB2YWx1ZT1cIlNhdmVcIj5FZGl0PC9idXR0b24+XHJcblx0XHRcdFx0PGJ1dHRvbiBjbGFzcz1cInVpIGludmVydGVkIHJlZCBidXR0b25cIiBpZD1cImFkZC1mbGlzdFwiPk5ldzwvYnV0dG9uPlxyXG5cdFx0XHRcclxuXHRcdFx0XHQ8dGFibGUgY2xhc3M9XCJ1aSBzZWxlY3RhYmxlIGludmVydGVkIHRhYmxlXCI+XHJcblx0XHRcdFx0XHQ8dGhlYWQ+XHJcblx0XHRcdFx0XHRcdDx0cj5cclxuXHRcdFx0XHRcdFx0XHQ8dGg+ZGF0ZTwvdGg+XHJcblx0XHRcdFx0XHRcdFx0PHRoPmNvc3Q8L3RoPlxyXG5cdFx0XHRcdFx0XHRcdDx0aCBjbGFzcz1cImxlZnQgYWxpZ25lZFwiPnR5cGU8L3RoPlxyXG5cdFx0XHRcdFx0XHQ8L3RyPlxyXG5cdFx0XHRcdFx0PC90aGVhZD5cclxuXHRcdFx0XHRcdDx0Ym9keT5cclxuXHRcdFx0XHRcdDwvdGJvZHk+XHJcblx0XHRcdFx0PC90YWJsZT5cclxuXHRcdFx0PC9kaXY+XHJcblx0XHRcIlwiXCJcdFx0XHJcblx0XHR0YWJsZSA9ICQodGFibGVfaHRtbClcclxuXHRcdEBkZWZhdWx0cy5jb250YWluZXIuYXBwZW5kKHRhYmxlKVxyXG5cdFx0QGRlZmF1bHRzLnRhYmxlID0gdGFibGVcclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHR0YWJsZS5maW5kKCcjZWRpdC1mbGlzdCcpLm9uICdjbGljaycsIChlKSAtPlxyXG5cdFx0XHRjb25zb2xlLmxvZyAnZWRpdC1mbGlzdCBjbGljayEnXHJcblx0XHRcdGlmICQodGhpcykuYXR0cigndmFsdWUnKSA9PSAnU2F2ZSdcclxuXHRcdFx0XHQjIGNoYW5nZSB0byBlZGl0IHZpZXdcclxuXHRcdFx0XHQjIGNyZWF0ZSBkYXRldGltZXBpY2tlclxyXG5cdFx0XHRcdCQodGhpcykudGV4dCgnU2F2ZScpXHJcblx0XHRcdFx0JCh0aGlzKS5hdHRyKCd2YWx1ZScsICdFZGl0JylcclxuXHRcdFx0XHQjIOaXtumXtOmAieaLqeWZqOebkeWQrOS6i+S7tlxyXG5cdFx0XHRcdCQoJy50aW1lLWl0ZW0nKS5kYXRldGltZXBpY2tlcih7XHJcblx0XHRcdFx0XHRsYW5nOiAnY2gnXHJcblx0XHRcdFx0XHRmb3JtYXQ6ICdZWVlZLW1tLWRkJ1xyXG5cdFx0XHRcdFx0dGltZXBpY2tlcjogZmFsc2VcclxuXHRcdFx0XHRcdG9uQ2hhbmdlRGF0ZVRpbWU6IChwYXJhbXMsIGlucHV0LCBldmVudCkgLT5cclxuXHRcdFx0XHRcdFx0IyDlkITnp43ml7bpl7TmoLzlvI9cclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgYXJndW1lbnRzLCBwYXJhbXMuZ2V0VVRDRGF0ZSgpLCBwYXJhbXMudG9EYXRlU3RyaW5nKCksIHBhcmFtcy50b0xvY2FsZURhdGVTdHJpbmcoKSwgcGFyYW1zLnRvTG9jYWxlU3RyaW5nKCksIHBhcmFtcy50b1VUQ1N0cmluZygpXHJcblx0XHRcdFx0XHRcdCMg55uu5YmN55So55qE5pivIHRvTG9jYWxlRGF0ZVN0cmluZ1xyXG5cdFx0XHRcdFx0XHQjICQodGhpcykudGV4dChwYXJhbXMudG9Mb2NhbGVEYXRlU3RyaW5nKCkpXHJcblx0XHRcdFx0XHRcdG5ld19kYXRlID0gcGFyYW1zLnRvTG9jYWxlRGF0ZVN0cmluZygpXHJcblx0XHRcdFx0XHRcdG5ld19kYXRlID0gbmV3X2RhdGUuc3BsaXQoJy8nKS5qb2luKCctJylcclxuXHRcdFx0XHRcdFx0aW5wdXQudGV4dChuZXdfZGF0ZSlcclxuXHJcblx0XHRcdFx0XHRvblNob3c6IChwYXJhbXMpIC0+XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nIGFyZ3VtZW50c1xyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0XHRjb3N0SW5wdXQgPSAoZSkgLT5cclxuXHRcdFx0XHRcdGlmICQodGhpcykuZmluZCgnaW5wdXQnKS5sZW5ndGggPT0gMFxyXG5cdFx0XHRcdFx0XHRvbGQgPSAkKHRoaXMpLnRleHQoKVxyXG5cdFx0XHRcdFx0XHQkKHRoaXMpLmF0dHIoJ3ZhbCcsIG9sZClcclxuXHRcdFx0XHRcdFx0aW5wdXRfaHRtbCA9IFwiXCJcIjxpbnB1dCBjbGFzcz1cInVpIGludmVydGVkIGlucHV0XCIgdHlwZT1cInRleHRcIiB2YWx1ZT1cIiN7b2xkfVwiLz5cIlwiXCJcclxuXHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKGlucHV0X2h0bWwpXHJcblx0XHRcdFx0JCgnLmNvc3QtaXRlbScpLm9uICdjbGljaycsIGNvc3RJbnB1dFxyXG5cdFx0XHRcdHR5cGVJbnB1dCA9IChlKSAtPlxyXG5cdFx0XHRcdFx0aWYgJCh0aGlzKS5maW5kKCdpbnB1dCcpLmxlbmd0aCA9PSAwXHJcblx0XHRcdFx0XHRcdG9sZCA9ICQodGhpcykudGV4dCgpXHJcblx0XHRcdFx0XHRcdCQodGhpcykuYXR0cigndmFsJywgb2xkKVxyXG5cdFx0XHRcdFx0XHRpbnB1dF9odG1sID0gXCJcIlwiPGlucHV0IGNsYXNzPVwidWkgaW52ZXJ0ZWQgaW5wdXRcIiB0eXBlPVwidGV4dFwiIHZhbHVlPVwiI3tvbGR9XCIvPlwiXCJcIlxyXG5cdFx0XHRcdFx0XHQkKHRoaXMpLmh0bWwoaW5wdXRfaHRtbClcclxuXHRcdFx0XHQkKCcudHlwZS1pdGVtJykub24gJ2NsaWNrJywgdHlwZUlucHV0XHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHQkKCcudGltZS1pdGVtJykuZGF0ZXRpbWVwaWNrZXIoJ2Rlc3Ryb3knKVxyXG5cdFx0XHRcdCQuZWFjaCAkKCcuY29zdC1pdGVtJyksIChpLCBlKSAtPlxyXG5cdFx0XHRcdFx0JGlucHV0ID0gJCh0aGlzKS5maW5kKCdpbnB1dCcpXHJcblx0XHRcdFx0XHRpZiAkaW5wdXQubGVuZ3RoICE9IDBcclxuXHRcdFx0XHRcdFx0bmV3X3ZhbCA9ICQodGhpcykuYXR0cigndmFsJylcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgJCh0aGlzKSwgJCh0aGlzKS5hdHRyKCd2YWwnKVxyXG5cdFx0XHRcdFx0XHRyZWcgPSAvXlthLXpBLVowLTlcXHU0ZTAwLVxcdTlmYTUgXSskL1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgcmVnLnRlc3QobmV3X3ZhbCkgPT0gdHJ1ZVxyXG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nICd0cnVlIHdoaWxlIHRlc3QgdGhlIHJlZzonLCBuZXdfdmFsXHJcblx0XHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKCRpbnB1dC5hdHRyKCd2YWx1ZScpKVxyXG5cdFx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2cgbmV3X3ZhbCwgJyBpcyBmYWxzZSB3aGlsZSB0ZXN0IHRoZSByZWcnXHJcblx0XHRcdFx0XHRcdFx0JCh0aGlzKS5odG1sKCQodGhpcykuYXR0cigndmFsJykpXHJcblx0XHRcdFx0IyBjaGFuZ2UgdG8gc2F2ZSB2aWV3XHJcblx0XHRcdFx0IyByZXF1ZXN0IHRvIHVwYXRlIGRhdGFcclxuXHRcdFx0XHRjb25zb2xlLmxvZyAnZGVmYXVsdHM6JywgY29udGV4dC5kZWZhdWx0c1xyXG5cdFx0XHRcdGNvbnRleHQuZGVmYXVsdHMuZmxpc3QuZW1pdCAnRkxpc3Q6ZGF0YUNoYW5nZScsIGNvbnRleHQuZGVmYXVsdHMuZGF0YXNcclxuXHRnZXRWYWw6IChvYmosIGRlZmF1bHRzKSAtPlxyXG5cdFx0cmV0dXJuIGlmIG9iaj8gdGhlbiBvYmogZWxzZSBkZWZhdWx0c1xyXG5cclxuXHRyZW5kZXI6IChkYXRhcykgLT5cclxuXHRcdGNvbnRleHQgPSBAXHJcblx0XHRAZGVmYXVsdHMuZGF0YXMgPSBkYXRhc1xyXG5cdFx0aXRlbXNfaHRtbCA9ICcnXHJcblx0XHQkLmVhY2ggZGF0YXMuZmxpc3QsIChpLCBlKSAtPlxyXG5cdFx0XHRkYXRlXyA9IGUuZGF0ZS5zbGljZSgwLCAxMClcclxuXHRcdFx0Y29zdF8gPSBlLm51bWJlclxyXG5cdFx0XHR0eXBlXyA9IGUudGFnX2Fyci5qb2luKCcgJylcclxuXHRcdFx0aXRlbV9odG1sID0gXCJcIlwiXHJcblx0XHRcdFx0PHRyPlxyXG5cdFx0XHRcdFx0PHRkIGNsYXNzPVwidGltZS1pdGVtXCI+I3tkYXRlX308L3RkPlxyXG5cdFx0XHRcdFx0PHRkIGNsYXNzPVwiY29zdC1pdGVtXCI+I3tjb3N0X308L3RkPlxyXG5cdFx0XHRcdFx0PHRkIGNsYXNzPVwidHlwZS1pdGVtXCI+I3t0eXBlX308L3RkPlxyXG5cdFx0XHRcdDwvdHI+XHJcblx0XHRcdFwiXCJcIlxyXG5cdFx0XHRpdGVtc19odG1sICs9IGl0ZW1faHRtbFxyXG5cdFx0QGRlZmF1bHRzLnRhYmxlLmZpbmQoJ3Rib2R5JykuaHRtbChpdGVtc19odG1sKVxyXG5cclxuXHJcbm9wdGlvbnMgPSBcclxuXHRuYW1lOiAnY2pzJ1xyXG5cdGNvbnRhaW5lcjogJCgnLnVpLmdyaWQuZmluYW5jZSAub2xpdmUudHdlbHZlLndpZGUuY29sdW1uJylcclxuXHRldmVudGJ1czogZXZlbnRidXNcclxuXHJcbl9mbGlzdCA9IG5ldyBGbGlzdChvcHRpb25zKVxyXG5cclxuXHJcbiMgZl9saXN0X3RhYmxlOiBuZXcgRkxpc3RUYWJsZShvcHRpb25zKVxyXG4iXX0=
