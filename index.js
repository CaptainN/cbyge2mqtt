import "dotenv/config";
import mqtt from "mqtt";
import fetch from "node-fetch";

const CBYGE_URL = process.env.CBYGE_URL;

const mqtt_client = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

function publish(topic, message) {
  mqtt_client.publish(topic, message, {
    qos: 1,
    retain: true,
  });
}

async function set_on(id, state) {
  const path = `/api/device/set_on?id=${id}&on=${state === "ON" ? "1" : "0"}`;

  // Optimistically set the result through MQTT
  publish(`homeassistant/gecync/state/${id}`, state);

  const result = await fetch(CBYGE_URL + path);
  const status = await result.json();

  console.log("status", status);
  if (status.error) {
    // TODO: Rollback the state?
    // Sometimes this times out, however, it does
    // seem to effect the state of the lights most
    // of the time.
  }
}

async function set_brightness(id, brightness) {
  const path = `/api/device/set_brightness?id=${id}&brightness=${brightness}`;

  // Optimistically set the result through MQTT
  publish(`homeassistant/gecync/brightness/${id}`, brightness);

  const result = await fetch(CBYGE_URL + path);
  const status = await result.json();

  console.log("status", status);
  if (status.error) {
    // TODO: Rollback the state?
    // Sometimes this times out, however, it does
    // seem to effect the state of the lights most
    // of the time.
  }
}

async function configure() {
  // Get list of lights
  console.log("fetching devices...");
  const result = await fetch(CBYGE_URL + "/api/devices?update_status=1");
  const devices = await result.json();
  console.log(devices);

  // Subscribe to status changes from home assistant
  mqtt_client.subscribe("homeassistant/gecync/#");

  // Send config to home assistant through mqtt
  devices.forEach(function (light) {
    const topic = "homeassistant/light/gecync/" + light.id + "/config";

    const payload = {
      name: light.name,
      unique_id: light.id,
      schema: "json",
      state_topic: "homeassistant/gecync/state/" + light.id,
      command_topic: "homeassistant/gecync/set-state/" + light.id,
      brightness_state_topic: "homeassistant/gecync/brightness/" + light.id,
      brightness_command_topic:
        "homeassistant/gecync/set-brightness/" + light.id,
      brightness_scale: 100,
      payload_on: "ON",
      payload_off: "OFF",
      supported_color_modes: ["onoff", "brightness", "color_temp", "rgb"],
      device: {
        identifiers: [light.id, light.name],
        name: light.name,
        model: "GE Cync Direct Connect Light Bulb",
        manufacturer: "GE",
        sw_version: "4.XX",
      },
    };

    mqtt_client.publish(topic, JSON.stringify(payload), {
      qos: 1,
      retain: true,
    });

    // Set the status through MQTT
    mqtt_client.publish(
      `homeassistant/gecync/state/${light.id}`,
      light.status.is_on ? "ON" : "OFF",
      {
        qos: 1,
        retain: true,
      }
    );
  });
}

/* subscribe to some topics */
mqtt_client.on("connect", async function () {
  console.log("connected");
  configure();
});

/* Forward MQTT packets to REST */
mqtt_client.on("message", function (topic, message) {
  console.log(topic.toString(), message.toString());
  const [, , command, id] = topic.toString().split("/");
  const payload = message.toString();
  switch (command) {
    case "set-state":
      set_on(id, payload);
      break;
    case "set-brightness":
      set_brightness(id, payload);
      break;
  }
});
