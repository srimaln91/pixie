import * as QueryString from 'query-string';
import { BehaviorSubject, Observable } from 'rxjs';
import { argsEquals } from 'utils/args-utils';

type Args = { [key: string]: string };

interface Location {
  search: string;
  protocol: string;
  host: string;
  pathname: string;
}

interface History {
  pushState(data: any, title: string, url?: string): void;
  replaceState(data: any, title: string, url?: string): void;
}

export interface Window {
  location: Location;
  history: History;
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
}

interface Params {
  args: Args;
  pathname: string;
  scriptId: string;
  scriptDiff: string;
}
// Exported for testing
export class URLParams {
  pathname: string;

  args: Args;

  scriptId: string;

  scriptDiff: string;

  onChange: Observable<Params>;

  private subject: BehaviorSubject<Params>;

  private prevParams: Params;

  constructor(private readonly privateWindow: Window) {
    this.syncWithPathname();
    this.syncWithQueryParams();
    const params = {
      args: { ...this.args },
      pathname: this.pathname,
      scriptDiff: this.scriptDiff,
      scriptId: this.scriptId,
    };
    this.prevParams = params;
    this.subject = new BehaviorSubject(params);
    this.onChange = this.subject;
  }

  private toURL(pathname: string, id: string, diff: string, args: Args) {
    const params = {
      ...(id ? { script: id } : {}),
      ...(diff ? { diff } : {}),
      ...args,
    };
    const { protocol, host } = this.privateWindow.location;
    const newQueryString = QueryString.stringify(params);
    const search = newQueryString ? `?${newQueryString}` : '';
    return `${protocol}//${host}${pathname}${search}`;
  }

  private syncWithQueryParams() {
    const { script, diff, ...args } = this.getQueryParams();
    this.scriptId = script;
    this.scriptDiff = diff || '';
    this.args = args;
  }

  private getQueryParams(): { [key: string]: string } {
    const params = {};
    const parsed = QueryString.parse(this.privateWindow.location.search);
    for (const key of Object.keys(parsed)) {
      if (typeof parsed[key] === 'string') {
        params[key] = parsed[key];
      }
    }
    return params;
  }

  private syncWithPathname() {
    this.pathname = this.getPathname();
  }

  getPathname(): string {
    return this.privateWindow.location.pathname;
  }

  private updateURL() {
    const newurl = this.toURL(this.pathname, this.scriptId, this.scriptDiff, this.args);
    this.privateWindow.history.replaceState({ path: newurl }, '', newurl);
  }

  private commitURL() {
    // Don't push the state if the params haven't changed.
    if (
      this.pathname && this.prevParams.pathname
      && this.scriptId === this.prevParams.scriptId
      && this.scriptDiff === this.prevParams.scriptDiff
      && argsEquals(this.args, this.prevParams.args)) {
      return;
    }
    const newurl = this.toURL(this.pathname, this.scriptId, this.scriptDiff, this.args);
    const oldurl = this.toURL(this.prevParams.pathname, this.prevParams.scriptId, this.prevParams.scriptDiff,
      this.prevParams.args);
    // Restore the current history state to the previous one, otherwise we would just be pushing the same state again.
    this.privateWindow.history.replaceState({ path: oldurl }, '', oldurl);
    this.privateWindow.history.pushState({ path: newurl }, '', newurl);
    this.prevParams = {
      pathname: this.pathname,
      scriptId: this.scriptId,
      scriptDiff: this.scriptDiff,
      args: this.args,
    };
  }

  setPathname(pathname: string) {
    this.pathname = pathname;
    this.updateURL();
  }

  setArgs(newArgs: Args) {
    // Omit the script and diff fields of newArgs.
    const { script, diff, ...args } = newArgs;
    this.args = args;
    this.updateURL();
  }

  setScript(id: string, diff: string) {
    this.scriptId = id;
    this.scriptDiff = diff;
    this.updateURL();
  }

  commitAll(newId: string, newDiff: string, newArgs: Args) {
    // Omit the script and diff fields of newArgs.
    const { script, diff, ...args } = newArgs;
    this.scriptId = newId;
    this.scriptDiff = newDiff;
    this.args = args;
    this.commitURL();
  }

  // TODO(nserrino): deprecate this.
  triggerOnChange() {
    this.syncWithPathname();
    this.syncWithQueryParams();
    this.subject.next({
      args: { ...this.args },
      pathname: this.pathname,
      scriptDiff: this.scriptDiff,
      scriptId: this.scriptId,
    });
  }
}

export default new URLParams(window);
