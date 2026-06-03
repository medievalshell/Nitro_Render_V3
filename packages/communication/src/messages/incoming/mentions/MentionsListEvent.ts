import { IMessageEvent } from '@nitrots/api';
import { MessageEvent } from '@nitrots/events';
import { MentionsListParser } from '../../parser';

export class MentionsListEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, MentionsListParser);
    }

    public getParser(): MentionsListParser
    {
        return this.parser as MentionsListParser;
    }
}
