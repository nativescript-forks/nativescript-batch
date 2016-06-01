// The MIT License (MIT)
// 
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.
"use strict";
var observable_1 = require("data/observable");
var observable_array_1 = require("data/observable-array");
var TypeUtils = require("utils/types");
var Batch = (function () {
    function Batch(firstAction) {
        this._invokeFinishedCheckForAll = false;
        this._operations = [];
        this.loggers = [];
        this._items = new observable_array_1.ObservableArray();
        this._object = new observable_1.Observable();
        this._operations
            .push(new BatchOperation(this, firstAction));
    }
    Batch.prototype.addItems = function () {
        for (var i = 0; i < arguments.length; i++) {
            this._items
                .push(arguments[i]);
        }
        return this;
    };
    Batch.prototype.addLogger = function (action) {
        this.loggers
            .push(action);
        return this;
    };
    Batch.prototype.after = function (afterAction) {
        this.afterAction = afterAction;
        return this;
    };
    Batch.prototype.before = function (beforeAction) {
        this.beforeAction = beforeAction;
        return this;
    };
    Object.defineProperty(Batch.prototype, "firstOperation", {
        get: function () {
            return this._operations[0];
        },
        enumerable: true,
        configurable: true
    });
    Batch.prototype.invokeFinishedCheckForAll = function (flag) {
        this._invokeFinishedCheckForAll = arguments.length < 1 ? true : flag;
        return this;
    };
    Object.defineProperty(Batch.prototype, "items", {
        get: function () {
            return this._items;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Batch.prototype, "object", {
        get: function () {
            return this._object;
        },
        enumerable: true,
        configurable: true
    });
    Batch.prototype.setObjectProperties = function (properties) {
        if (!TypeUtils.isNullOrUndefined(properties)) {
            for (var p in properties) {
                this._object.set(p, properties[p]);
            }
        }
        return this;
    };
    Batch.prototype.setResult = function (value) {
        this._result = value;
        return this;
    };
    Batch.prototype.setResultAndValue = function (value) {
        return this.setResult(value)
            .setValue(value);
    };
    Batch.prototype.setValue = function (value) {
        this._value = value;
        return this;
    };
    Batch.prototype.start = function () {
        var finishedFlags = new Array(this._operations.length);
        for (var i = 0; i < finishedFlags.length; i++) {
            finishedFlags[i] = false;
        }
        var me = this;
        var result = this._result;
        var previousValue;
        var skipWhile;
        var value = this._value;
        var createCheckIfFinishedAction = function (index) {
            return function () {
                finishedFlags[index] = true;
                for (var i = 0; i < finishedFlags.length; i++) {
                    if (!finishedFlags[i]) {
                        return;
                    }
                }
                if (!TypeUtils.isNullOrUndefined(me.whenAllFinishedAction)) {
                    var finishedOperation = new BatchOperation(me, me.whenAllFinishedAction);
                    var ctx = new BatchOperationContext(previousValue);
                    ctx.result = result;
                    ctx.value = value;
                    ctx.setExecutionContext(BatchOperationExecutionContext.finished);
                    finishedOperation.action(ctx);
                }
            };
        };
        for (var i = 0; i < this._operations.length; i++) {
            var ctx = new BatchOperationContext(previousValue, this._operations, i);
            ctx.result = result;
            ctx.value = value;
            ctx.checkIfFinishedAction = createCheckIfFinishedAction(i);
            if (!TypeUtils.isNullOrUndefined(skipWhile)) {
                if (skipWhile(ctx)) {
                    ctx.checkIfFinishedAction();
                    continue;
                }
            }
            skipWhile = undefined;
            var invokeCompletedAction = function () {
                ctx.setExecutionContext(BatchOperationExecutionContext.complete);
                if (ctx.invokeComplete && ctx.operation.completeAction) {
                    ctx.operation.completeAction(ctx);
                }
                if (me._invokeFinishedCheckForAll) {
                    ctx.checkIfFinished();
                }
            };
            var handleErrorAction = true;
            try {
                // global "before" action
                if (ctx.invokeBefore && ctx.operation.beforeAction) {
                    ctx.setExecutionContext(BatchOperationExecutionContext.before);
                    ctx.operation.beforeAction(ctx);
                }
                // action to invoke
                if (ctx.invokeAction && ctx.operation.action) {
                    ctx.setExecutionContext(BatchOperationExecutionContext.execution);
                    ctx.operation.action(ctx);
                }
                // global "after" action
                if (ctx.invokeAfter && ctx.operation.batch.afterAction) {
                    ctx.setExecutionContext(BatchOperationExecutionContext.after);
                    ctx.operation.batch.afterAction(ctx);
                }
                // success action
                if (ctx.invokeSuccess && ctx.operation.successAction) {
                    handleErrorAction = false;
                    ctx.setExecutionContext(BatchOperationExecutionContext.success);
                    ctx.operation.successAction(ctx);
                }
                invokeCompletedAction();
            }
            catch (e) {
                ctx.setError(e);
                ctx.setExecutionContext(BatchOperationExecutionContext.error);
                if (handleErrorAction && ctx.operation.errorAction) {
                    ctx.operation.errorAction(ctx);
                }
                else {
                    if (!ctx.operation.ignoreOperationErrors) {
                        throw e;
                    }
                }
                invokeCompletedAction();
            }
            previousValue = ctx.nextValue;
            value = ctx.value;
            result = ctx.result;
            skipWhile = ctx.skipWhilePredicate;
        }
        return result;
    };
    Batch.prototype.whenAllFinished = function (action) {
        this.whenAllFinishedAction = action;
        return this;
    };
    return Batch;
}());
var BatchLogContext = (function () {
    function BatchLogContext(ctx, time, msg) {
        this._context = ctx;
        this._message = msg;
    }
    Object.defineProperty(BatchLogContext.prototype, "batch", {
        get: function () {
            return this.operation.batch;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchLogContext.prototype, "context", {
        get: function () {
            return this._context;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchLogContext.prototype, "message", {
        get: function () {
            return this._message;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchLogContext.prototype, "operation", {
        get: function () {
            return this.context.operation;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchLogContext.prototype, "time", {
        get: function () {
            return this._time;
        },
        enumerable: true,
        configurable: true
    });
    return BatchLogContext;
}());
var BatchOperation = (function () {
    function BatchOperation(batch, action) {
        this._skipBefore = false;
        this.ignoreOperationErrors = false;
        this._batch = batch;
        this.action = action;
    }
    BatchOperation.prototype.addItems = function () {
        for (var i = 0; i < arguments.length; i++) {
            this._batch.items
                .push(arguments[i]);
        }
        return this;
    };
    BatchOperation.prototype.addLogger = function (action) {
        this._batch.addLogger(action);
        return this;
    };
    BatchOperation.prototype.after = function (afterAction) {
        this._batch.afterAction = afterAction;
        return this;
    };
    Object.defineProperty(BatchOperation.prototype, "batch", {
        get: function () {
            return this._batch;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperation.prototype, "batchId", {
        get: function () {
            return this._batch.id;
        },
        set: function (value) {
            this._batch.id = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperation.prototype, "batchName", {
        get: function () {
            return this._batch.name;
        },
        set: function (value) {
            this._batch.name = value;
        },
        enumerable: true,
        configurable: true
    });
    BatchOperation.prototype.before = function (beforeAction) {
        this._batch.beforeAction = beforeAction;
        return this;
    };
    Object.defineProperty(BatchOperation.prototype, "beforeAction", {
        get: function () {
            return this._batch.beforeAction;
        },
        enumerable: true,
        configurable: true
    });
    BatchOperation.prototype.complete = function (completedAction) {
        this.completeAction = completedAction;
        return this;
    };
    BatchOperation.prototype.error = function (errAction) {
        this.errorAction = errAction;
        return this;
    };
    BatchOperation.prototype.ignoreErrors = function (flag) {
        this.ignoreOperationErrors = arguments.length < 1 ? true : flag;
        return this;
    };
    BatchOperation.prototype.invokeFinishedCheckForAll = function (flag) {
        if (arguments.length < 1) {
            this._batch.invokeFinishedCheckForAll();
        }
        else {
            this._batch.invokeFinishedCheckForAll(flag);
        }
        return this;
    };
    Object.defineProperty(BatchOperation.prototype, "items", {
        get: function () {
            return this._batch.items;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperation.prototype, "object", {
        get: function () {
            return this._batch.object;
        },
        enumerable: true,
        configurable: true
    });
    BatchOperation.prototype.setBatchId = function (value) {
        this._batch.id = value;
        return this;
    };
    BatchOperation.prototype.setBatchName = function (value) {
        this._batch.name = value;
        return this;
    };
    BatchOperation.prototype.setId = function (value) {
        this.id = value;
        return this;
    };
    BatchOperation.prototype.setName = function (value) {
        this.name = value;
        return this;
    };
    BatchOperation.prototype.setObjectProperties = function (properties) {
        this._batch.setObjectProperties(properties);
        return this;
    };
    BatchOperation.prototype.setResult = function (value) {
        this._batch.setResult(value);
        return this;
    };
    BatchOperation.prototype.setResultAndValue = function (value) {
        this._batch.setResultAndValue(value);
        return this;
    };
    BatchOperation.prototype.setValue = function (value) {
        this._batch.setValue(value);
        return this;
    };
    BatchOperation.prototype.skipBefore = function (value) {
        this._skipBefore = arguments.length < 1 ? true : value;
        return this;
    };
    BatchOperation.prototype.start = function () {
        this._batch.start();
    };
    BatchOperation.prototype.success = function (successAction) {
        this.successAction = successAction;
        return this;
    };
    BatchOperation.prototype.then = function (action) {
        return new BatchOperation(this._batch, action);
    };
    BatchOperation.prototype.whenAllFinished = function (action) {
        this._batch.whenAllFinished(action);
        return this;
    };
    return BatchOperation;
}());
var BatchOperationContext = (function () {
    function BatchOperationContext(previousValue, operations, index) {
        this.invokeAction = true;
        this.invokeAfter = true;
        this.invokeBefore = true;
        this.invokeComplete = true;
        this.invokeSuccess = true;
        this._index = index;
        if (arguments.length > 2) {
            this._operation = operations[index];
            this._isLast = index >= (operations.length - 1);
        }
        this._prevValue = previousValue;
        this.checkIfFinishedAction = function () { };
    }
    Object.defineProperty(BatchOperationContext.prototype, "batch", {
        get: function () {
            return this.operation.batch;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "batchId", {
        get: function () {
            return this.operation.batch.id;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "batchName", {
        get: function () {
            return this.operation.batch.name;
        },
        enumerable: true,
        configurable: true
    });
    BatchOperationContext.prototype.checkIfFinished = function () {
        this.checkIfFinishedAction();
        return this;
    };
    Object.defineProperty(BatchOperationContext.prototype, "context", {
        get: function () {
            var execCtx = this.executionContext;
            if (TypeUtils.isNullOrUndefined(execCtx)) {
                return undefined;
            }
            return BatchOperationExecutionContext[execCtx];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "executionContext", {
        get: function () {
            return this._executionContext;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "error", {
        get: function () {
            return this._error;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "id", {
        get: function () {
            return this.operation.id;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "index", {
        get: function () {
            return this._index;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "isBetween", {
        get: function () {
            if (this._index !== undefined) {
                return 0 !== this._index &&
                    !this._isLast;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "isFirst", {
        get: function () {
            if (this._index !== undefined) {
                return 0 === this._index;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "isLast", {
        get: function () {
            return this._isLast;
        },
        enumerable: true,
        configurable: true
    });
    BatchOperationContext.prototype.log = function (msg) {
        var ctx = new BatchLogContext(this, new Date(), msg);
        for (var i = 0; i < this.batch.loggers.length; i++) {
            try {
                var l = this.batch.loggers[i];
                l(ctx);
            }
            catch (e) {
            }
        }
        return this;
    };
    Object.defineProperty(BatchOperationContext.prototype, "name", {
        get: function () {
            return this.operation.name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "operation", {
        get: function () {
            return this._operation;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BatchOperationContext.prototype, "prevValue", {
        get: function () {
            return this._prevValue;
        },
        enumerable: true,
        configurable: true
    });
    BatchOperationContext.prototype.setExecutionContext = function (value) {
        this._executionContext = value;
        return this;
    };
    BatchOperationContext.prototype.setError = function (error) {
        this._error = error;
        return this;
    };
    BatchOperationContext.prototype.setResultAndValue = function (value) {
        this.result = value;
        this.value = value;
        return this;
    };
    BatchOperationContext.prototype.skip = function (cnt) {
        if (arguments.length < 1) {
            cnt = 1;
        }
        return this.skipWhile(function (ctx) { return cnt-- > 0; });
    };
    BatchOperationContext.prototype.skipAll = function (flag) {
        if (arguments.length < 1) {
            flag = true;
        }
        return this.skipWhile(function () { return flag; });
    };
    BatchOperationContext.prototype.skipNext = function (flag) {
        this.skip(arguments.length < 1 ? 1
            : (flag ? 1 : 0));
        return this;
    };
    BatchOperationContext.prototype.skipWhile = function (predicate) {
        this.skipWhilePredicate = predicate;
        return this;
    };
    return BatchOperationContext;
}());
/**
 * List of batch operation execution types.
 */
(function (BatchOperationExecutionContext) {
    /**
     * Global "before" action.
     */
    BatchOperationExecutionContext[BatchOperationExecutionContext["before"] = 0] = "before";
    /**
     * Operation action is executed.
     */
    BatchOperationExecutionContext[BatchOperationExecutionContext["execution"] = 1] = "execution";
    /**
     * Global "after" action.
     */
    BatchOperationExecutionContext[BatchOperationExecutionContext["after"] = 2] = "after";
    /**
     * "Success" action is executed.
     */
    BatchOperationExecutionContext[BatchOperationExecutionContext["success"] = 3] = "success";
    /**
     * "Error" action is executed.
     */
    BatchOperationExecutionContext[BatchOperationExecutionContext["error"] = 4] = "error";
    /**
     * "Completed" action is executed.
     */
    BatchOperationExecutionContext[BatchOperationExecutionContext["complete"] = 5] = "complete";
    /**
     * Global "finish all" action.
     */
    BatchOperationExecutionContext[BatchOperationExecutionContext["finished"] = 6] = "finished";
})(exports.BatchOperationExecutionContext || (exports.BatchOperationExecutionContext = {}));
var BatchOperationExecutionContext = exports.BatchOperationExecutionContext;
/**
 * Creates a new batch.
 *
 * @function newBatch
 *
 * @return {IBatchOperation} The first operation of the created batch.
 */
function newBatch(firstAction) {
    return new Batch(firstAction).firstOperation;
}
exports.newBatch = newBatch;
//# sourceMappingURL=index.js.map