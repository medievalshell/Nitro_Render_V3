import { IMessageEvent } from '@nitrots/api';
import { MessageEvent } from '@nitrots/events';
import { ConsoleReadReceiptParser } from '../../parser';

export class ConsoleReadReceiptEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, ConsoleReadReceiptParser);
    }

    public getParser(): ConsoleReadReceiptParser
    {
        return this.parser as ConsoleReadReceiptParser;
    }
}
