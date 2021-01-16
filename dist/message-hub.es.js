/*!
 * @evecalm/message-hub v0.1.5
 * Copyright© 2021 Saiya https://github.com/oe/messagehub
 */
/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

var _this = undefined;
var WINDOW_ID = Math.random().toString(36).slice(2);
// save current window it's self
var WIN = self;
var msgID = 0;
var WinHandlerMap = [
    ['*', {}]
];
WIN.addEventListener('message', function (evt) { return __awaiter(_this, void 0, void 0, function () {
    var reqMsg, sourceWin, matchedMap, methodName, args, method, data, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(evt);
                reqMsg = evt.data;
                sourceWin = evt.source || WIN;
                if (!isRequest(reqMsg) || !sourceWin)
                    return [2 /*return*/];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                matchedMap = WinHandlerMap.find(function (wm) { return wm[0] === sourceWin; });
                methodName = reqMsg.methodName, args = reqMsg.args;
                method = matchedMap && matchedMap[1][methodName] || WinHandlerMap[0][1][methodName];
                // tslint:disable-next-line
                if (typeof method !== 'function') {
                    console.warn("[MessageHub] no corresponding handler found for " + methodName + ", message from", sourceWin);
                    throw new Error("[MessageHub] no corresponding handler found for " + methodName);
                }
                return [4 /*yield*/, method.apply(null, args)
                    // @ts-ignore
                ];
            case 2:
                data = _a.sent();
                // @ts-ignore
                sourceWin.postMessage(buildRespMsg(data, reqMsg, true));
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                // @ts-ignore
                sourceWin.postMessage(buildRespMsg(error_1, reqMsg, false));
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
var messageHub = {
    WINDOW_ID: WINDOW_ID,
    on: function (peer, handlerMap) {
        var pair = WinHandlerMap.find(function (pair) { return pair[0] === peer; });
        if (pair) {
            pair[1] = Object.assign({}, pair[1], handlerMap);
            return;
        }
        WinHandlerMap.push([peer, handlerMap]);
    },
    emit: function (peer, methodName) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        var msg = buildReqMsg(methodName, args);
        // @ts-ignore
        peer.postMessage(msg);
        return new Promise(function (resolve, reject) {
            var onCallback = function (evt) {
                var response = evt.data;
                // console.log('response', evt, response, WIN)
                if (!isResponse(msg, response))
                    return;
                WIN.removeEventListener('message', onCallback);
                response.isSuccess ? resolve(response.data) : reject(response.data);
            };
            WIN.addEventListener('message', onCallback);
        });
    }
};
function buildReqMsg(methodName, args) {
    return {
        winID: WINDOW_ID,
        msgID: ++msgID,
        type: 'request',
        methodName: methodName,
        args: args
    };
}
function buildRespMsg(data, reqMsg, isSuccess) {
    return {
        winID: reqMsg.winID,
        msgID: reqMsg.msgID,
        type: 'response',
        isSuccess: isSuccess,
        data: data
    };
}
function isRequest(reqMsg) {
    return reqMsg && reqMsg.winID &&
        reqMsg.winID !== WINDOW_ID &&
        reqMsg.msgID &&
        reqMsg.type === 'request';
}
function isResponse(reqMsg, respMsg) {
    return reqMsg && reqMsg &&
        respMsg.winID === reqMsg.winID &&
        respMsg.msgID === reqMsg.msgID &&
        respMsg.type === 'response';
}

export default messageHub;
