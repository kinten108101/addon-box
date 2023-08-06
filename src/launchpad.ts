import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Pango from 'gi://Pango';

import { Config } from './config.js';
import { AddonStorage, Configuration, ItemType } from './addon-storage.js';
import { Addon, AddonFlags } from './addons.js';
import { gobjectClass } from './utils/decorator.js';
import * as Markup from './markup.js';
import { g_param_default } from './utils.js';

class AddonlistPageItem extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkAddonlistPageItem',
      Properties: {
        'origin': GObject.ParamSpec.object('origin', 'origin', 'origin', g_param_default, Addon.$gtype),
        'name': GObject.ParamSpec.string('name', 'name', 'name', GObject.ParamFlags.READWRITE, ''),
        'id': GObject.ParamSpec.string('id', 'id', 'id', GObject.ParamFlags.READWRITE, ''),
        'enabled': GObject.ParamSpec.boolean('enabled', 'enabled', 'enabled', GObject.ParamFlags.READWRITE, true),
        'description': GObject.ParamSpec.string('description', 'description', 'description', GObject.ParamFlags.READWRITE, ''),
        'description-short': GObject.ParamSpec.string('description-short', '', '', GObject.ParamFlags.READWRITE, ''),
        'last-update': GObject.ParamSpec.string('last-update', 'last-update', 'last-update', GObject.ParamFlags.READWRITE, ''),
        'in-randomizer': GObject.ParamSpec.boolean('in-randomizer', 'in-randomizer', 'in-randomizer', GObject.ParamFlags.READWRITE, false),
        'flags': GObject.ParamSpec.int('flags', 'flags', 'flags', GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT, AddonFlags.NONE, AddonFlags.max, AddonFlags.NONE),
        'has-archive': GObject.ParamSpec.boolean('has-archive', 'has-archive', 'has-archive', GObject.ParamFlags.READWRITE, false),
        'install_missing_archive': GObject.ParamSpec.boolean('install_missing_archive', 'install_missing_archive', 'install_missing_archive', GObject.ParamFlags.READWRITE, false),
      },
    }, this);
  }

  origin!: Addon;
  name: string;
  id: string;
  enabled: boolean;
  description: string;
  description_short: string;
  last_update: string;
  in_randomizer: boolean;
  flags!: AddonFlags;
  has_archive: boolean;
  install_missing_archive: boolean;

  constructor(param: {
    origin: Addon;
    initialState?: Configuration;
  }) {
    const { initialState, ..._params } = param;
    super(_params);
    if (!AddonFlags.valid(this.flags)) {
      throw new Error('AddonFlag enum isn\'t set up correctly!');
    }
    this.name = `${Markup.MakeCompatPango(this.origin.title || '')}`;
    this.id = `${this.origin.id || ''}`;
    this.enabled = (() => {
      if (initialState) {
        return initialState.active;
      }
      return false;
    })();
    this.description = (() => {
      const markup = Markup.SteamMd2Pango(this.origin.description || '');
      try {
        Pango.parse_markup(markup, -1, '_');
      } catch (error) {
        return Markup.MakeCompatPango(this.origin.description || '');
      }
      return markup;
    })();
    this.description_short = (() => {
      return Markup.MakeCompatPango(this.origin.description || '').substring(0, 100);
    })();
    this.last_update = (() => {
      const date = this.origin.timeUpdated;
      if (date === undefined) return '';
      const display = `${date.toDateString()} @ ${date.toLocaleTimeString()}`;
      return display;
    })();
    this.in_randomizer = false;
    this.flags = this.origin.flags;
    this.has_archive = this.origin.has_archive_lite();
    this.install_missing_archive = this.origin.is_viable_remote_archive_registration();
  }
}

export class LaunchpadRow extends Adw.ExpanderRow {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkLaunchpadRow',
      Properties: {
        'itemk': GObject.ParamSpec.object(
          'itemk', 'itemk', 'itemk',
          GObject.ParamFlags.READWRITE,
          AddonlistPageItem.$gtype),
      },
      Template: `resource://${Config.config.app_rdnn}/ui/launchpad-row.ui`,
      Children: [
        'title_field',
        'description_field',
        'last_update_field',
        'toggle',
        'seeDetails',
        'removeAddon',
        'moveSection',
        'popoverMenu',
        'enterPosition',
        'warning',
        'no-archive',
        'install-archive',
        'remove-small',
        'ztitle',
        'zsubtitle',
        'zexcerpt',
      ],
    }, this);
  }

  itemk!: AddonlistPageItem;

  title_field!: Gtk.Label;
  description_field!: Gtk.Label;
  last_update_field!: Gtk.Label;
  toggle!: Gtk.Switch;
  seeDetails!: Gtk.Button;
  removeAddon!: Gtk.Button;

  moveSection!: Gio.Menu;
  moveUp: Gio.MenuItem;
  moveDown: Gio.MenuItem;
  popoverMenu!: Gtk.PopoverMenu;
  warning!: Gtk.Button;
  no_archive!: Gtk.Button;
  install_archive!: Gtk.Button;
  remove_small!: Gtk.Button;

  ztitle!: Gtk.Label;
  zsubtitle!: Gtk.Label;
  zexcerpt!: Gtk.Label;

  constructor(params: { itemk: AddonlistPageItem } & Adw.ExpanderRow.ConstructorProperties) {
    super(params);
    const id = GLib.Variant.new_string(this.itemk.id);
    const flags = GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL;
    this.itemk.bind_property('name', this.ztitle, 'label', flags);
    this.itemk.bind_property('id', this.zsubtitle, 'label', flags);
    this.itemk.bind_property('description-short', this.zexcerpt, 'label', flags);

    this.itemk.bind_property('name', this.title_field, 'label', flags);
    this.itemk.bind_property('enabled', this.toggle, 'active', flags);
    this.itemk.bind_property('description', this.description_field, 'label', flags);
    this.itemk.bind_property('last_update', this.last_update_field, 'label', flags);
    if (AddonFlags.includes(this.itemk.flags, AddonFlags.DUMMY)) {
      this.set_title('<i>Unknown add-on</i>');
      this.warning.set_visible(true);
    }
    if (!this.itemk.has_archive) {
      this.no_archive.set_visible(true);
    }
    if (this.itemk.install_missing_archive) {
      this.install_archive.set_visible(true);
    }
    this.install_archive.set_action_target_value(id);
    this.seeDetails.set_action_target_value(id);
    this.removeAddon.set_action_target_value(id);
    this.remove_small.set_action_target_value(id);

    this.moveUp = new Gio.MenuItem();
    this.moveUp.set_label('Move Up');
    this.moveUp.set_action_and_target_value('addons.move-up', id);
    this.moveSection.append_item(this.moveUp);

    this.moveDown = new Gio.MenuItem();
    this.moveDown.set_label('Move Down');
    this.moveDown.set_action_and_target_value('addons.move-down', id);
    this.moveSection.append_item(this.moveDown);

    const update = () => {
      // target value must be the next state to the current state aka the inverse
      const gvariant = GLib.Variant.new_tuple([GLib.Variant.new_string(this.itemk.id), GLib.Variant.new_boolean(!this.itemk.enabled)])
      this.toggle.set_action_target_value(gvariant);
    };
    this.itemk.connect('notify::enabled', update);
    update();
  }
}

class LaunchpadSection extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkLaunchpadSection',
      Template: `resource://${Config.config.app_rdnn}/ui/launchpad-section.ui`,
      Properties: {
        'model': GObject.ParamSpec.object(
          'model',
          'model',
          'model',
          GObject.ParamFlags.READWRITE,
          Gio.ListStore.$gtype,
        ),
        'title': GObject.ParamSpec.string(
          'title',
          'Title',
          'Title of this section',
          g_param_default,
          '',
        ),
        'subtitle': GObject.ParamSpec.string(
          'subtitle',
          'subtitle',
          'subtitle',
          g_param_default,
          null,
        ),
      },
      Children: [
        'section_list',
      ],
    }, this);
  }

  model!: Gio.ListStore<AddonlistPageItem>;
  title!: string;
  section_list!: Gtk.ListBox;

  drop_target!: Gtk.DropTarget;
  origin_idx: number;

  constructor(props: { title: string } & Gtk.Box.ConstructorProperties) {
    super(props);
    this.section_list.bind_model(this.model, this.rowFactory.bind(this));
    // new GtkDropTarget did not work
    this.drop_target = Gtk.DropTarget.new(LaunchpadRow.$gtype, Gdk.DragAction.MOVE);
    this.section_list.add_controller(this.drop_target);
    this.origin_idx = 0;
  }

  bind(
  { addon_storage,

  }:
  { addon_storage: AddonStorage;

  }) {
    this.drop_target.connect('drop', (_, origin: LaunchpadRow, __, y): boolean => {
      if (origin === null) {
        console.warn('Could not retrieve packaged drag value. Quitting...');
        return false;
      }

      const row = this.section_list.get_row_at_y(y)
      if (row === null) {
        console.warn('Couldn\'t map drop coords to list coords. Quitting...');
        return false;
      }

      const origin_idx = origin.get_index();
      const target_idx = row.get_index();
      if (origin_idx === target_idx) {
        console.log('Drop target is not a different index. Quitting...');
        return true;
      }
      // FIXME(kinten):
      // Here we are avoiding signal because default loadorder-order-changed reaction is
      // to rerender entire list. Instead of avoiding, we should write some check for a
      // sentinel to make an exception for this case where we have a workaround.
      /*
      this.activate_action(
        'addons.insert-silent',
        GLib.Variant.new_tuple([
          GLib.Variant.new_string((origin as LaunchpadRow).itemk.id),
          GLib.Variant.new_int16(origin_idx),
          GLib.Variant.new_int16(target_idx),
        ]),
      );
      */
      console.time('dnd-insert');
      /*
      context.application.addonStorage.loadorder_insert(origin_idx, target_idx);
      */
      addon_storage.loadorder_insert_silent(origin_idx, target_idx);
      this.section_list.remove(origin);
      this.section_list.insert(origin, target_idx);
      console.log(origin.grab_focus());
      addon_storage.emit(AddonStorage.Signals.loadorder_order_changed);
      row.set_state_flags(Gtk.StateFlags.NORMAL, true);
      console.timeEnd('dnd-insert');
      return true;
    });
  }

  rowFactory(val: GObject.Object): Gtk.Widget {
    const _val = val as AddonlistPageItem;
    const row = new LaunchpadRow({
      itemk: _val,
    });
    row.set_can_focus(true);
    this.#setupDrag(row);
    return row;
  }

  #setupDrag = (row: LaunchpadRow) => {
    const drop_controller = new Gtk.DropControllerMotion()
    const drag_source = new Gtk.DragSource({
      actions: Gdk.DragAction.MOVE,
    });
    row.add_controller(drop_controller);
    row.add_controller(drag_source);

    let drag_x: number;
    let drag_y: number;

    drag_source.connect('prepare', (_, x, y) => {
      drag_x = x;
      drag_y = y;

      const val = new GObject.Value();
      val.init(LaunchpadRow.$gtype);
      val.set_object(row);

      return Gdk.ContentProvider.new_for_value(val);
    });

    drag_source.connect('drag-begin', (_, drag) => {
      this.origin_idx = row.get_index();
      const allocation = row.get_allocation();
      const drag_widget = new Gtk.ListBox();
      drag_widget.set_size_request(allocation.width, allocation.height);
      drag_widget.add_css_class('boxed-list');

      // cases for a model item representative for a list row
      // 1. updateCase case
      // 2. this case
      const drag_row = new LaunchpadRow({ itemk: row.itemk });
      drag_widget.append(drag_row);
      drag_widget.drag_highlight_row(drag_row);

      const icon = Gtk.DragIcon.get_for_drag(drag);
      // @ts-ignore
      icon.child = drag_widget;
      drag.set_hotspot(drag_x, drag_y);
    })

    drop_controller.connect('enter', () => {
      if (row.get_index() === this.origin_idx) return;
      this.section_list.drag_highlight_row(row);
    });

    drop_controller.connect('leave', () => {
      this.section_list.drag_unhighlight_row();
    });

  }
}

// View model interface (Interactor)
class ListStore<T extends GObject.Object> extends Gio.ListStore<T> {
  static {
    GObject.registerClass({
      GTypeName: 'ListStore',
      Signals: {
        'state-changed': {},
      },
    }, this);
  }
}

export class AddonlistModel extends ListStore<AddonlistPageItem> {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkAddonlistModel',
      Implements: [
        Gio.ListModel,
      ],
    }, this);
  }

  addonStorage!: AddonStorage;
  // TODO(kinten): Unless we do diffing, there is no difference between a BST and an array if we'll just refill content every thing. So for now, use an array
  arrStorage: AddonlistPageItem[] = [];

  constructor() {
    super({
      item_type: AddonlistPageItem.$gtype,
    });
  }

  bind(
  { addon_storage,
  }:
  { addon_storage: AddonStorage;
  }) {
    this.addonStorage = addon_storage;
    addon_storage.connect_after(AddonStorage.Signals.addons_changed, this.updateModel);
    addon_storage.connect_after(AddonStorage.Signals.loadorder_changed, this.updateModel);
    // NOTE(kinten) do not listen to loadorder-config-changed because all of these configs are controlled by launchpad actions -> the widgets have changed by themselves.
    this.updateModel();
  }

  updateModel = () => {
    const items: AddonlistPageItem[] = [];
    this.addonStorage.loadorder.forEach(x => {
      const config = this.addonStorage.configmap.get(x);
      if (!config) {
        return;
      }
      switch (config.type) {
      case ItemType.separator: {
        const sep = this.addonStorage.sepmap.get(x);
        if (!sep) return;
        //const item = this.separator2item(sep);
        //items.push(item);
      } break;
      case ItemType.addon: {
        const addon = this.addonStorage.get(x) || this.addonStorage.make_dummy(x);
        const item = this.addon2item(addon);
        items.push(item);
      } break;
      }
    });
    this.changeState(items);
  }

  addon2item(addon: Addon): AddonlistPageItem {
    const id = addon.vanityId;
    const config = this.addonStorage.configmap.get(id);
    if (config === undefined) {
      console.warn(`Could not find configuration when building addonListPageItem for ${id}`);
    }

    const item = new AddonlistPageItem({
      origin: addon,
      initialState: config,
    });
    return item;
  }



  changeState(col: AddonlistPageItem[]) {
    this.arrStorage = col;
    this.emit('state-changed');
  }

  vfunc_get_n_items(): number {
    return this.arrStorage?.length || 0;
  }

  vfunc_get_item(position: number): AddonlistPageItem | null {
    const val = this.arrStorage?.[position];
    if (val === undefined) {
      return null;
    }
    return val;
  }
}

@gobjectClass({
  Template: `resource://${Config.config.app_rdnn}/ui/launchpad-page.ui`,
  Children: [ 'enable-addon', 'defaultSection' ],
})
export class LaunchpadPage extends Gtk.Box {
  model: AddonlistModel;
  enable_addon!: Gtk.Switch;
  defaultSection!: LaunchpadSection;

  constructor(params = {}) {
    super(params);
    this.model = new AddonlistModel();
    this.model.connect('state-changed', () => {
      this._refreshAll();
    });

    this.enable_addon.connect('notify::active', (button) => {
      // target value must be the next state to the current state aka the inverse
      button.set_action_target_value(GLib.Variant.new_boolean(!button.get_active()));
    });
  }

  bind(
  { addon_storage,

  }:
  { addon_storage: AddonStorage,

  }) {
    addon_storage.connect(AddonStorage.Signals.addons_enabled_changed, () => {
      const val = addon_storage.get_addons_enabled();
      this.enable_addon.set_active(val); // sync state across windows
      this.defaultSection.set_sensitive(val);
    });
    this.enable_addon.set_active(addon_storage.get_addons_enabled());
  }

  _refreshAll() {
    this.defaultSection.model.remove_all();
    for (let i = 0; i < this.model.get_n_items(); i++) {
      const addon: AddonlistPageItem | null = this.model.get_item(i) as unknown as AddonlistPageItem;
      if (addon === null) {
        continue;
      }
      this.defaultSection.model.append(addon);
    }

    if (this.defaultSection?.model.get_n_items()) {
      this.defaultSection?.set_visible(true);
    } else {
      this.defaultSection?.set_visible(false);
    }

  }
}
