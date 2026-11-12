import { Injectable } from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";

/** Discriminator of a Horizon message payload (e.g. "pick", "viewerReady"). */
export type MessagePayload = NonNullable<
    HrzProtocol.TypedMessage.$Properties["payload"]
>;

/**
 * Wraps the Horizon engine API: notifies subscribers once the API is ready and
 * pumps the engine message queue (50 ms) dispatching typed messages to handlers.
 * Framework-agnostic logic, exposed as an Angular root service.
 */
@Injectable({ providedIn: "root" })
export class HorizonService {
    private apiReadyHandlers: ((api: HrzApi.AsyncApi) => void)[] = [];
    private messageHandlersByType = new Map<
        MessagePayload,
        ((message: HrzProtocol.ITypedMessage) => void)[]
    >();
    private api: HrzApi.AsyncApi | null = null;

    onApiReady(callback: (api: HrzApi.AsyncApi) => void) {
        if (this.api) {
            callback(this.api);
        } else {
            this.apiReadyHandlers.push(callback);
        }
    }

    setApi(api: HrzApi.AsyncApi) {
        this.api = api;
        for (const handler of this.apiReadyHandlers) {
            handler(api);
        }
        this.apiReadyHandlers = [];

        setInterval(() => this.receiveMessages(api), 50);
    }

    onMessage(
        type: MessagePayload,
        handler: (message: HrzProtocol.ITypedMessage) => void,
    ) {
        let handlers = this.messageHandlersByType.get(type);
        if (!handlers) {
            handlers = [];
            this.messageHandlersByType.set(type, handlers);
        }
        handlers.push(handler);
    }

    private async receiveMessages(api: HrzApi.AsyncApi) {
        while (true) {
            const dequeued = await api.MessageQueueService.dequeueMessages({
                maxMessageCount: 20,
            });
            if (
                dequeued.messages.length === 0 &&
                (dequeued.queueSize?.messageCount || 0) === 0
            ) {
                break;
            }

            for (const message of dequeued.messages) {
                const handlers =
                    message.payload &&
                    this.messageHandlersByType.get(message.payload);
                if (handlers) {
                    for (const handler of handlers) {
                        handler(message);
                    }
                }
            }
        }
    }
}
