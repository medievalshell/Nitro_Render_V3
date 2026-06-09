import { NitroLogger, NitroVersion, parseConfigJsonFromResponse } from '@nitrots/utils';
import { IConfigurationManager } from './IConfigurationManager';

export class ConfigurationManager implements IConfigurationManager
{
    private _definitions: Map<string, unknown> = new Map();
    private _config: any = {};
    private _missingKeys: string[] = [];
    private _initialized: boolean = false;

    constructor()
    {
        NitroVersion.sayHello();
    }

    public async init(): Promise<void>
    {
        // init() is invoked more than once during boot: bootstrap.ts loads the config
        // before React mounts, then App's warm-up calls it again. reloadConfiguration()
        // begins by clearing the store, which opens a window where every synchronous
        // getValue() falls through to a one-shot "Missing configuration key" warning
        // (mentions_ui.*, external.plugins, loading.task.*, …) before the urls re-land.
        // Make init() idempotent so the store is built exactly once. A genuine live
        // reload still calls reloadConfiguration() directly and is unaffected.
        if(this._initialized) return;

        await this.reloadConfiguration();

        this._initialized = true;
    }

    public async reloadConfiguration(): Promise<void>
    {
        try
        {
            this.resetConfiguration();

            const defaultConfig = this.getDefaultConfig();

            if(!defaultConfig) throw new Error('Missing NitroConfig: make sure window.NitroConfig is defined in index.html');

            this.parseConfiguration(defaultConfig, true);

            const configurationUrls = this.getValue<string[]>('config.urls').slice();

            if(!configurationUrls || !configurationUrls.length) throw new Error('No config.urls defined in NitroConfig — expected an array like ["/renderer-config.json", "/ui-config.json"]');

            for(const url of configurationUrls)
            {
                if(!url || !url.length) continue;

                // Per-URL resilience: un singolo config rotto NON deve abortire il boot
                // ne cancellare le chiavi degli altri config gia caricati. Logga e prosegui.
                try
                {
                    const response = await fetch(url);

                    if(response.status !== 200) throw new Error(`server returned HTTP ${ response.status }`);

                    const json = await parseConfigJsonFromResponse(response, url);

                    this.parseConfiguration(json);
                }
                catch(urlError)
                {
                    NitroLogger.error(`[ConfigurationManager] Failed to load config "${ url }": ${ urlError?.message || urlError } — continuing with remaining config urls`);
                }
            }
        }

        catch (err)
        {
            throw new Error(err.message || String(err));
        }
    }

    public resetConfiguration(): void
    {
        this._definitions.clear();
        this._config = {};
        this._missingKeys = [];
    }

    public parseConfiguration(data: { [index: string]: any }, overrides: boolean = false): boolean
    {
        if(!data) return false;

        try
        {
            const regex = new RegExp(/\${(.*?)}/g);

            for(const key in data)
            {
                let value = data[key];

                if(typeof value === 'string') value = this.interpolate(value, regex);

                if(this._definitions.has(key))
                {
                    if(overrides) this.setValue(key, value);
                }
                else
                {
                    this.setValue(key, value);
                }
            }

            return true;
        }

        catch (e)
        {
            NitroLogger.error(e.stack);

            return false;
        }
    }

    public interpolate(value: string, regex: RegExp = null): string
    {
        if(!regex) regex = new RegExp(/\${(.*?)}/g);

        const pieces = value.match(regex);

        if(pieces && pieces.length)
        {
            for(const piece of pieces)
            {
                const existing = (this._definitions.get(this.removeInterpolateKey(piece)) as string);

                if(existing) (value = value.replace(piece, existing));
            }
        }

        if(value.indexOf('%timestamp%') >= 0)
        {
            value = value.replace(/%timestamp%/gi, Date.now().toString());
        }

        return value;
    }

    private removeInterpolateKey(value: string): string
    {
        return value.replace('${', '').replace('}', '');
    }

    public getValue<T>(key: string, value: T = null): T
    {
        let existing = this._definitions.get(key);

        if(existing === undefined)
        {
            if(this._missingKeys.indexOf(key) >= 0) return value;

            this._missingKeys.push(key);

            NitroLogger.warn(`Missing configuration key: ${key}`);

            existing = value;
        }

        return (existing as T);
    }

    public setValue<T>(key: string, value: T): void
    {
        // _definitions (flat key -> value) is the source of truth for getValue(). Set it
        // FIRST so a key is always retrievable even if the nested _config mirror below
        // cannot represent it (see the collision note).
        this._definitions.set(key, value);

        const parts = key.split('.');

        let last = this._config;

        for(let i = 0; i < parts.length; i++)
        {
            const part = parts[i].toString();

            if(i !== (parts.length - 1))
            {
                // Two config keys can collide on a prefix: e.g. "theme.default" (a string)
                // and "theme.default.pieces" (an array). Writing a child property onto a
                // scalar node throws a TypeError in strict mode (ES modules), which
                // parseConfiguration's try/catch swallows — silently dropping EVERY key
                // parsed after the collision (here: mentions_ui.*, loading.*, external.plugins).
                // Coerce any non-object node to an object so nesting always succeeds.
                if(!last[part] || typeof last[part] !== 'object') last[part] = {};

                last = last[part];

                continue;
            }

            last[part] = value;
        }
    }

    public getDefaultConfig(): { [index: string]: any }
    {
        return window.NitroConfig;
    }

    public get definitions(): Map<string, unknown>
    {
        return this._definitions;
    }
}
