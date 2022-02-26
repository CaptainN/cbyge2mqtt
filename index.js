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

async function set_on(id, payload) {
  const path = `/api/device/set_on?id=${id}&on=${payload.state === "ON" ? "1" : "0"}`;

  // Optimistically set the result through MQTT
  publish(`homeassistant/gecync/state/${id}`, JSON.stringify(payload));

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
  publish(`homeassistant/gecync/brightness/${id}`, JSON.stringify(brightness));

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
  // console.log(devices);

  // Subscribe to status changes from home assistant
  mqtt_client.subscribe("homeassistant/gecync/#");
  mqtt_client.subscribe("homeassistant/status");

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
      color_temp_state_topic: "homeassistant/gecync/color-temp/" + light.id,
      color_temp_command_topic: "homeassistant/gecync/set-color-temp/" + light.id,
      brightness: true,
      brightness_scale: 100,
      color_mode: true,
      supported_color_modes: ["brightness"],
      device: {
        identifiers: [light.id, light.name],
        name: light.name,
        model: "GE Cync Direct Connect Light Bulb",
        manufacturer: "GE",
        sw_version: "4.XX",
      },
    };

    publish(topic, JSON.stringify(payload));

    // Set the status through MQTT
    publish(
      `homeassistant/gecync/state/${light.id}`,
      JSON.stringify({ state: light.status.is_on ? "ON" : "OFF" })
    );
  });
}

/* subscribe to some topics */
mqtt_client.on("connect", function () {
  console.log("connected");
  configure();
});

mqtt_client.on("reconnect", function () {
  console.log("reconnected");
  configure();
});

function retryConnection() {
  mqtt_client.reconnect();
}

mqtt_client.on("close", function () {
  console.log("connection lost");
  // wait a while then reconnect
  setTimeout(retryConnection, 15000);
});

mqtt_client.on("disconnect", function () {
  console.log("disconnected");
  // wait a while then reconnect
  setTimeout(retryConnection, 15000);
});

/* Forward MQTT packets to REST */
mqtt_client.on("message", function (topic, message) {
  console.log("message:", topic.toString(), message.toString());
  const [, scope, command, id] = topic.toString().split("/");
  const payload = JSON.parse(message.toString());
  if (scope === "gecync") {
    switch (command) {
      case "set-state":
        set_on(id, payload);
        break;
      case "set-brightness":
        set_brightness(id, payload);
        break;
    }
  } else if (scope === "status") {
    if (payload === "online") {
      configure();
    }
  }
});
