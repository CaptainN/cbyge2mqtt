cbyge2mqtt
==========

UPDATE: I went ahead and ported this to cbyge directly, and the result is a much more stable (if still very slow) server. I also haven't tested it long enough to know if it's stable, and I already know of a few different bugs. It's pre-alpha quality software, based on a reverse engineering effort that has no guarantee to keep working. But it's better than this one!

----------

This is a quick little proof of concept to link the [cbyge experiment](https://github.com/unixpickle/cbyge) to mqtt to interface with [home assistant](https://www.home-assistant.io/). It's essentially a bridge to allow control over GE Cync (formerly C by GE) lights by integrating with the GE (xlink) servers.

It works! But it's kind of silly. It requires a few things.

1. Set up home assistant with the [MQTT addon](https://www.home-assistant.io/integrations/mqtt/).
2. Set up and run cbyge somewhere on your network (or the same machine). Log in to your GE account.
3. Set the env vars, install package, and run the server!

So basically, to turn on my lights, I have a hass on my phone, which sends a signal to a server in my basement, which sends a signal to this project on my dev machine, which sends a signal back to cbyge running on my server, which sends to the GE servers, which sends a signal to my lights, to turn them on.

It's a little bit flaky. I'm not sure what causes it. The method calls constantly time out, and there are synchronization issues (due to the lack of polling). There's also a lot of unfinished functionality and very few safety checks. It's just a proof of concept. It probably wouldn't take much effort to complete it, but I don't if it's worth it, given the experimental nature of cbyge.

But it (mostly) works. So far, you can use this to:

1. Get a list of lights from your GE Cync accounts, and auto discover them in Home Assistant.
2. Turn them on and off, group them, etc.
3. Set the brightness of individual lights.

What it could be (one day):

1. Retry failed remote requests.
2. Poll for status updates (I don't know how feasible this really is).
3. Honestly, this should probably be ported in to cbyge.
4. Or the stuff in cbyge ported to this.
5. Oh, it'd be nice to be able to set color temp and rgb - I might add that before long.
6. There should be broadly more error handling in this code base.
7. It could be ported to Typescript, for some type safety.
8. Maybe some runtypes could be added for runtime validate, etc.

Bah, it's a proof of concept. It would be nice to have a reliable set up for managing these lights. But this will do for now.
