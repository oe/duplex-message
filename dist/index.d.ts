declare const MessageHub: {
    WINDOW_ID: string;
    on(peer: Window | "*" | Worker, handlerMap: Function | Record<string, Function>): void;
    off(peer: Window | "*" | Worker): void;
    emit(peer: Window | Worker, methodName: string, ...args: any[]): Promise<{}>;
};
export default MessageHub;
