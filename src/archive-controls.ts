import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export default function ArchiveActions({
  action_map,
}:
{
  action_map: Gio.ActionMap;
}) {
  const install_archive = new Gio.SimpleAction({
    name: 'archive.install-archive',
    parameter_type: GLib.VariantType.new('s'),
  });
  install_archive.connect('activate', (_action, parameter) => {
    (async () => {
      if (parameter === null) throw new Error;
      const id = parameter.get_string();
      id;
    })().catch(error => logError(error));
  });
  action_map.add_action(install_archive);
}
