/**
 * Widget behaviour settings.
 */

import { useSettings } from "../../services/settingsStore";
import { Panel, Row, Section, Toggle } from "../../components/Controls";
import * as native from "../../services/native";

export default function WidgetSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  return (
    <>
      <Section title="Window">
        <Panel>
          <Row
            title="Always on top"
            description="Keep the clock above other windows."
          >
            <Toggle
              checked={settings.alwaysOnTop}
              label="Always on top"
              onChange={(checked) => {
                update({ alwaysOnTop: checked });
                void native.setAlwaysOnTop(checked);
              }}
            />
          </Row>
          <Row
            title="Click through"
            description="Let mouse clicks pass through the clock to the desktop. Use the tray or the context menu to turn this off."
          >
            <Toggle
              checked={settings.clickThrough}
              label="Click through"
              onChange={(checked) => {
                update({ clickThrough: checked });
                void native.setClickThrough(checked);
              }}
            />
          </Row>
          <Row
            title="Show shadow"
            description="Draw a drop shadow under the panel."
          >
            <Toggle
              checked={settings.showShadow}
              label="Show shadow"
              onChange={(checked) => update({ showShadow: checked })}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Interaction">
        <Panel>
          <Row title="Resizable" description="Allow dragging the corner grip to resize.">
            <Toggle
              checked={settings.resizable}
              label="Resizable"
              onChange={(checked) => {
                update({ resizable: checked });
                void native.setResizable(checked);
              }}
            />
          </Row>
          <Row title="Draggable" description="Allow dragging the clock with the mouse.">
            <Toggle
              checked={settings.draggable}
              label="Draggable"
              onChange={(checked) => update({ draggable: checked })}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Visibility">
        <Panel>
          <Row
            title="Show the clock"
            description="Hide the widget without quitting the app. It stays available from the tray."
          >
            <Toggle
              checked={settings.widgetVisible}
              label="Show the clock"
              onChange={(checked) => {
                update({ widgetVisible: checked });
                void (checked ? native.showWidget() : native.hideWidget());
              }}
            />
          </Row>
        </Panel>
      </Section>
    </>
  );
}