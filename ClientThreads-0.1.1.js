ClientThreads = (function() {

    var 
        _WSTR = "",     // Кеш объектов для воркера. Для последующих вызовов конструктора   
        _CONV,          // Общий объект конвертора, используется в клиенте и в воркере
        _WRKR,          // Воркер, запускается в blobUrl
        CT;             // Возвращаемый конструктор
    
    // Конец объявления переменных. Начало методов


    _CONV = {
        is: {
            // Если объект
            object: function(a) {
                return (typeof a === "object") ? true : false;
            },

            // Если массив
            array: function array(a) {
                //return ((typeof a === "object") && (a instanceof Array)) ? true : false;
                return (Array.isArray(a)) ? true : false;
            },
            /*
                // Если регулярное выражение
                regExp: function array(a) {
                    return ((typeof a === 'object') && (a instanceof RegExp)) ? true : false;
                },
            */
            // Если Строка
            string: function(a) {
                return (typeof a === "string") ? true : false;
            },

            // Если функция
            function: function(a) {
                return (typeof a === "function") ? true : false;
            },

            // Если функция в тексте
            functionInTxt: function(a) {
                return (typeof a === "string") && (a.search(/^\s*function/i) == 0) ? true : false;
            }
        },
        
        // Переделка аргументов. Конвертирует код в текст
        codeToTxt: function(arg) {
            
            var that = this;
            
            // Рекурсивно ищет функции в объектах и в массивах и на оборот, с разным уровнем вложеностью
            function rcrsvSrch(arg) {
                //console.log('codeToTxt recursion')
                // если объект
                if(that.is.object(arg)) {
                    
                    // если массив
                    if(that.is.array(arg)) {
                        
                        // обход масива для поиска функций
                        var i = arg.length;
                        while(i--) {
                        //for(var i=0,ln=arg.length;i<ln;i++) {
                        
                            // если функция
                            if(that.is.function(arg[i])) {
                                arg[i] = arg[i].toString();
                            }
                            
                            // если объект
                            if(that.is.object(arg[i])) {
                                arg[i] = rcrsvSrch(arg[i]);
                            }
                        }
                        
                        return arg;
                        
                    } else {
                        
                    // если не массив а все же объект
                        for(var x in arg) {
                            
                            // если в объекте функция
                            if(that.is.function(arg[x])) {
                                arg[x] = arg[x].toString();
                            }
                            
                            // если в объекте массив а в ней функция
                            if(that.is.object(arg[x])) {
                                arg[x] = rcrsvSrch(arg[x]);
                            }
                            
                        }
                        return arg;
                    
                    }
                    
                    
                }
            }
            
            switch(typeof arg) {
            case "function":
                return arg.toString();
            break;  
            case "object":
                return rcrsvSrch(arg);
            break;
            default:
                return arg;
            break;
            }
            
        },
        
        // Переделка аргументов. Конвертирует текст в код
        txtToCode: function(arg, thread) {
            
            var that = this;

            // Рекурсивно ищет функции в объектах и в массивах и на оборот, с разным уровнем вложеностью
            function rcrsvSrch(arg) {
                //console.log('txtToCode recursion')
                // если объект
                if(that.is.object(arg)) {
                    
                    // если массив
                    if(that.is.array(arg)) {
                        
                        // обход масива для поиска функций
                        var i = arg.length;
                        while(i--) {
                        //for(var i=0,ln=arg.length;i<ln;i++) {
                            
                            // если функция
                            if(that.is.functionInTxt(arg[i])) {
                                arg[i] = eval("("+arg[i]+")");
                            }
                            
                            // если объект
                            if(that.is.object(arg[i])) {
                                arg[i] = rcrsvSrch(arg[i]);
                            }
                        }
                        
                        return arg;
                        
                    } else {
                        
                    // если не массив а все же объект
                        for(var x in arg) {
                            
                            // если функция
                            if(that.is.functionInTxt(arg[x])) {
                                arg[x] = eval("("+arg[x]+")");
                            }
                            
                            // если в объекте массив а в ней функция
                            if(that.is.object(arg[x])) {
                                arg[x] = rcrsvSrch(arg[x]);
                            }
                            
                        }
                        return arg;
                    
                    }
                    
                    
                }
            }
            
            switch(typeof arg) {
            case "string":
                // если функция
                if(that.is.functionInTxt(arg)) {
                    return eval("("+arg+")");
                } else return arg;
            break;  
            case "object":
                return rcrsvSrch(arg);
            break;
            default:
                return arg;
            break;
            }
        }
    };

    _WRKR = {
        thread: {},                 // объект используемый внутри воркера
        init: function(e) {
            
        var
            CONV            = _CONV,
            that            = this,
            firstInitMsg    = false;    // флаг, блокируется после первого сообщения;
        
            addEventListener("message", function(e) {
                 // первое сообщение в поток - код самого воркера
                if(!firstInitMsg) {
                    
                    that.thread.arguments   = CONV.txtToCode(e.data.args, that.thread);     // аргументы
                    that.thread.is          = CONV.is;                                      // проверочные методы для пользовательского использования
                    that.thread.onMessage   = function(msg, e) {};                          // обработка ассинхронных сообщений
                    that.thread.close       = function() {close();};                        // закрытие воркера внутри воркера
                    that.thread.postMessage = function(msg) {                               // отправка сообщений в колбэк
                        if(msg) postMessage(CONV.codeToTxt(msg));
                    };
                
                var 
                    userFunc    = CONV.txtToCode(e.data.func, that.thread),
                    res         = userFunc(e); // Запуск кода и передача сообщения, если есть
    
                    if(res) {postMessage(CONV.codeToTxt(res));}
                    
                    // flag
                    firstInitMsg = true;
                } else {
                    // последующие сообщения в поток
                    var msg = CONV.txtToCode(e.data);
                    that.thread.onMessage(msg, e); // После первого сообщения, остальные сообщения вызывают колбэк onMessage в контексте воркера
                }
            }, false);
            
            
        }
    };
    
    CT = function (args, workerFunc, callback, errFn) {
    
        // если конструктор вызван без new, возвращаем с new
        if (!(this instanceof CT)) {
            return new CT(args, workerFunc, callback, errFn);
        }
        
        this.is = _CONV.is; // ссылка на проверочные методы
        
        // конвертирование общих объектов, которые используются тут и там, в текст для воркера
        if(!_WSTR) {
            _WSTR   =   this.objToTxt(_CONV, "_CONV");
            _WSTR   +=  this.objToTxt(_WRKR, "_WRKR");
            _WSTR   +=  "_WRKR.init();";
        }
        
        // Создание виртуальной страницы с кодом воркера
        var blob        = new Blob([_WSTR]),
        blobURL         = window.URL.createObjectURL(blob);
        
        this.worker     = new Worker(blobURL);
    
        // колбэк
        if(callback) {
            this.worker.addEventListener("message", function(e) {
                var msg = _CONV.txtToCode(e.data);
                callback(msg, e);
            }, false);
        }
        
        // обработка ошибок
        if(!errFn) errFn = function(e) { console.log("ErrorMsg: "+e.message+"\n"+"File Name: "+e.filename+"\n"+"Line: "+e.lineno); };
        this.worker.addEventListener("error", errFn, false);
        
        // Передача данных в воркер
        this.worker.postMessage({
            args: _CONV.codeToTxt(args),
            func: _CONV.codeToTxt(workerFunc)
        });
    
    };
    
     // Метод рекурсивно конвертирует вложенные объекты (для общего использования тут и в воркере) в текст для BolobUrl и создание воркера.
    CT.prototype.objToTxt = function(obj, objName, d) {
        
        var arr = [],
        x;
        
        for(x in obj) {
            if(obj.hasOwnProperty(x)) {
                if(this.is.object(obj[x])) {
                    arr.push(this.objToTxt(obj[x], x, ":"));
                } else {
                    arr.push(x +":"+ obj[x]);
                }
            }
        }
        
        if(!d) d = "="; // оператор присваивания для внешних и внутренних значений к имени объекта.  ":" или "="
        return objName+d+"{"+arr.join(",")+"}\n";
    };

    // закрытие треда
    CT.prototype.close = function() {
        this.worker.terminate();
    };

    // сообщение в воркер
    CT.prototype.postMessage = function(msg) {
        this.worker.postMessage(_CONV.codeToTxt(msg));
    };

    
    return CT;
}());
