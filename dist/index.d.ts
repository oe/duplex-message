declare const messageHub: {
    WINDOW_ID: string;
    on(peer: Window | "*" | Worker, handlerMap: Record<string, Function>): void;
    emit(peer: Window | Worker, methodName: string, ...args: any[]): Promise<{}>;
};
export default messageHub;
