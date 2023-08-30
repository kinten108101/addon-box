import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { MakeTitleCompat, SteamMd2Pango } from './markup.js';
import {
  GtkChildren,
  GtkTemplate,
  param_spec_object,
  param_spec_variant,
  registerClass,
} from './steam-vpk-utils/utils.js';
import { APP_RDNN } from './const.js';
import { AddonEntry, Addonlist, AddonlistPageItem } from './model/addonlist.js';

export class LaunchpadRow extends Adw.ExpanderRow {
  static [GtkTemplate] = `resource://${APP_RDNN}/ui/launchpad-row.ui`;
  static [GtkChildren] = [
    'ztitle',
    'zsubtitle',
    'zexcerpt',
    'description_field',
    'last_update_field',
    'toggle',
  ];

  static {
    registerClass({
      Properties: {
        idgvariant: param_spec_variant({
          name: 'id-gvariant',
          type: GLib.VariantType.new('s'),
          default_value: GLib.Variant.new_string(''),
        }),
      },
    }, this);
  }

  ztitle!: Gtk.Label;
  zsubtitle!: Gtk.Label;
  zexcerpt!: Gtk.Label;
  description_field!: Gtk.Label;
  last_update_field!: Gtk.Label;
  toggle!: Gtk.Switch;

  bind_with_item(item: AddonEntry) {
    const update = () => {
      // target value must be the next state to the current state aka the inverse
      const gvariant = GLib.Variant.new_tuple([
        GLib.Variant.new_string(item.id),
        GLib.Variant.new_boolean(!item.enabled),
      ]);
      (this['toggle'] as Gtk.Switch).set_action_target_value(gvariant);
    };
    const on_enabled = item.connect('notify::enabled', update);
    update();
    const signals: number[] = [];
    signals.push(on_enabled);
    const flags = GObject.BindingFlags.SYNC_CREATE;
    const bindings = [
      item.bind_property_full('name',  this.ztitle, 'label',
        flags,
        (_binding, from: string | null) => {
          if (from === null) return [false, ''];
          return [true, MakeTitleCompat(from)];
        }, null as unknown as GObject.TClosure<any, any>),
      item.bind_property_full('id', this.zsubtitle, 'label',
        flags,
        (_binding, from: string | null) => {
          if (from === null) return [false, ''];
          return [true, MakeTitleCompat(from)];
        }, null as unknown as GObject.TClosure<any, any>),
      item.bind_property_full('id', this, 'id-gvariant',
        flags,
        (_binding, from: string | null) => {
          if (from === null) return [false, GLib.Variant.new_string('')];
          return [true, GLib.Variant.new_string(from)];
        }, null as unknown as GObject.TClosure<any, any>),
      item.bind_property_full('description', this.zexcerpt, 'label',
        flags,
        (_binding, from: string | null) => {
          if (from === null) return [false, ''];
          return [true, MakeTitleCompat(from.substring(0, 100))];
        }, null as unknown as GObject.TClosure<any, any>),
      item.bind_property('enabled', this.toggle, 'active', flags),
      item.bind_property_full('description', this.description_field, 'label',
        flags,
        (_binding, from: string | null) => {
          if (from === null) return [false, ''];
          return [true, SteamMd2Pango(from)];
        }, null as unknown as GObject.TClosure<any, any>),
      item.bind_property_full('last-update', this.last_update_field, 'label',
        flags,
        (_binding, from: Date | null) => {
          if (from === null) return [false, ''];
          return [true, `${from.toDateString()}`];
        }, null as unknown as GObject.TClosure<any, any>),
    ];
    return {
      bindings,
      signals,
    };
  }
}

export class LaunchpadPage extends Adw.Bin {
  static [GObject.properties] = {
    loadorder: param_spec_object({ name: 'loadorder', objectType: Gio.ListStore.$gtype }),
  };
  static [GtkTemplate] = `resource://${APP_RDNN}/ui/launchpad-page.ui`;
  static [GtkChildren] = [ 'addonlist_box', 'stack' ];

  static {
    registerClass({}, this);
  }

  addonlist!: Gtk.ListView;
  addonlist_box!: Gtk.ListBox;
  stack!: Adw.ViewStack;

  loadorder: Addonlist = new Addonlist;

  constructor(params = {}) {
    super(params);
    this.loadorder.connect('notify::n-items', this.update_list_appearance);
    this._setup_boxedlist();
  }

  _setup_boxedlist() {
    this.addonlist_box.bind_model(this.loadorder.sort_model, (item: GObject.Object) => {
      if (!(item instanceof AddonlistPageItem)) throw new Error;
      const widget = new LaunchpadRow();
      if (item instanceof AddonEntry && widget instanceof LaunchpadRow) {
        widget.bind_with_item(item);
      } else throw Error('Unrecognized combination');
      return widget;
    });
  }

  _setup_listview() {
    const factory = new Gtk.SignalListItemFactory();
    const list_item_data = new WeakMap<GObject.Object, {
      bindings: GObject.Binding[];
      signals: number[];
    }>();
    factory.connect('setup', (_obj, list_item: Gtk.ListItem) => {
      console.log('setup');
      const widget = new LaunchpadRow();
      list_item.set_child(widget);
    });
    factory.connect('bind', (_obj, list_item: Gtk.ListItem) => {
      console.log('bind');
      const data = {
        bindings: [] as GObject.Binding[],
        signals: [] as number[],
      }
      list_item_data.set(list_item.item, data);
      const item = list_item.item;
      if (!(item instanceof AddonlistPageItem)) throw new Error;
      const widget = list_item.child;
      if (item instanceof AddonEntry && widget instanceof LaunchpadRow) {
        const { bindings, signals } = widget.bind_with_item(item);
        data.bindings.push(
          ...bindings,
        );
        data.signals.push(
          ...signals,
        );
      } else throw Error('Unrecognized combination');
    });
    factory.connect('unbind', (_obj, list_item: Gtk.ListItem) => {
      console.log('unbind');
      const data = list_item_data.get(list_item.item);
      if (data === undefined) {
        console.log('Data not available to unbind. Skipping...');
        return;
      }
      data.bindings.forEach(x => {
        x.unbind();
      });
      const obj = list_item.item;
      data.signals.forEach(x => {
        obj.disconnect(x);
      });
    });
    factory.connect('teardown', (_obj, _list_item: Gtk.ListItem) => {

    });
    this.addonlist.set_factory(factory);
    this.addonlist.set_model(new Gtk.NoSelection({ model: this.loadorder.sort_model }));
  }

  vfunc_realize(): void {
    super.vfunc_realize();
    this.update_list_appearance();
  }

  update_list_appearance = () => {
    if (this.loadorder.get_n_items() === 0) {
      this.stack.set_visible_child_name('empty');
    } else {
      this.stack.set_visible_child_name('main');
    }
  }
}
