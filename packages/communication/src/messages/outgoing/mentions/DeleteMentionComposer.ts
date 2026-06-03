import { IMessageComposer } from '@nitrots/api';

export class DeleteMentionComposer implements IMessageComposer<ConstructorParameters<typeof DeleteMentionComposer>>
{
    private _data: ConstructorParameters<typeof DeleteMentionComposer>;

    constructor(mentionId: number)
    {
        this._data = [mentionId];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
