function getCondition(code) {
  if (code === 0) return { text: "Clear Skies", icon: "☀️" };
  if (code >= 1 && code <= 3) return { text: "Partly Cloudy", icon: "🌤️" };
  if (code === 45 || code === 48) return { text: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 55) return { text: "Light Drizzle", icon: "🌧️" };
  if (code >= 61 && code <= 65) return { text: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { text: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { text: "Showers", icon: "🌦️" };
  if (code >= 95 && code <= 99) return { text: "Thunderstorm", icon: "⛈️" };
  return { text: "Overcast", icon: "☁️" };
}

// Generates dynamic hazard text indicators based on raw metrics
function checkSevereAlerts(maxTemp, windSpeed, code) {
  let alerts = [];
  if (maxTemp >= 40) {
    alerts.push(`🚨 **CRITICAL ALERT:** EXCESSIVE HEATWAVE WARNING (${maxTemp}°C). Stay indoors and hydrated.`);
  } else if (maxTemp >= 35) {
    alerts.push(`⚠️ **ADVISORY:** Extreme Summer Heat detected (${maxTemp}°C).`);
  }
  
  if (windSpeed >= 50 || code >= 95) {
    alerts.push(`🚨 **CRITICAL ALERT:** CYCLONIC/SEVERE STORM THREAT. High wind vectors (${windSpeed} km/h) & atmospheric turbulence.`);
  } else if (windSpeed >= 30) {
    alerts.push(`⚠️ **ADVISORY:** Strong wind squalls present (${windSpeed} km/h).`);
  }
  return alerts.length ? `\n${alerts.join("\n")}\n` : "";
}

function makeSleekCard(title, content) {
  return `┌───  **${title.toUpperCase()}** ───┐\n\n${content}\n└────────────────────────┘`;
}

oc.thread.on("MessageAdded", async function({message}) {
  if (message.author !== "user") return;

  let raw = message.content.trim();
  if (!raw.toLowerCase().startsWith("/weather")) return;

  let args = raw.split(" ").slice(1);
  let mode = args[0] ? args[0].toLowerCase() : "";

  // Default coordinate setup: Ranchi, India
  let lat = 23.34;
  let lon = 85.31;
  let locationLabel = "Ranchi, India";

  try {
    // --- STEP 1: PARSE AND GEOLOCATE TARGET REGIONS ---
    if (mode && mode !== "tomorrow" && mode !== "week") {
      let queryCity = encodeURIComponent(args.join(" "));
      let geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${queryCity}&count=1&language=en&format=json`);
      let geoData = await geoRes.json();
      
      if (geoData.results && geoData.results.length > 0) {
        let match = geoData.results[0];
        lat = match.latitude;
        lon = match.longitude;
        locationLabel = `${match.name}, ${match.country || ""}`;
      } else {
        oc.thread.messages.push({ author: "system", content: `⚠️ Region unknown for "${args.join(" ")}". Reverting to default area.` });
      }
    }

    // --- STEP 2: FETCH API TELEMETRY MATRICES ---
    let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
    let response = await fetch(url);
    let data = await response.json();

    let outputContent = "";
    let systemPromptWeather = "";

    // Generate current metrics to run structural checks against
    let current = data.current_weather;
    let todaysMax = data.daily.temperature_2m_max[0];
    let hazardBanners = checkSevereAlerts(todaysMax, current.windspeed, current.weathercode);

    // --- OPTION A: TOMORROW FORECAST ---
    if (mode === "tomorrow" || (args[1] && args[1].toLowerCase() === "tomorrow")) {
      let maxTemp = data.daily.temperature_2m_max[1];
      let minTemp = data.daily.temperature_2m_min[1];
      let cond = getCondition(data.daily.weathercode[1]);
      let tomorrowHazards = checkSevereAlerts(maxTemp, current.windspeed, data.daily.weathercode[1]);

      outputContent = `📍 **Location:** ${locationLabel}\n📅 **Target:** Tomorrow\n\n${cond.icon} **Condition:** ${cond.text}\n📈 **Expected Max:** ${maxTemp}°C\n📉 **Expected Min:** ${minTemp}°C\n${tomorrowHazards}`;
      systemPromptWeather = `Tomorrow's outlook stands as ${cond.text} between ${minTemp}°C and ${maxTemp}°C`;
    } 
    
    // --- OPTION B: WEEK MATRIX SUMMARY ---
    else if (mode === "week" || (args[1] && args[1].toLowerCase() === "week")) {
      let lines = [`📍 **7-Day Trend:** ${locationLabel}\n`];
      if (hazardBanners) lines.push(hazardBanners);

      for (let i = 0; i < 7; i++) {
        let cond = getCondition(data.daily.weathercode[i]);
        let max = data.daily.temperature_2m_max[i];
        let min = data.daily.temperature_2m_min[i];
        let dayLabel = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `Day +${i}`;
        
        lines.push(`\`${dayLabel.padEnd(9)}\` ${cond.icon}  ${max}°C / ${min}°C  —  _${cond.text}_`);
      }
      outputContent = lines.join("\n");
      systemPromptWeather = `The weekly forecast sits around an immediate high of ${todaysMax}°C`;
    } 
    
    // --- OPTION C: CURRENT DEFAULT CONDENSED CORE ---
    else {
      let cond = getCondition(current.weathercode);
      
      outputContent = `📍 **Location:** ${locationLabel}\n\n${cond.icon} **Current Outlook:** ${cond.text}\n🌡️ **Temperature:** ${current.temperature}°C  (High: ${todaysMax}°C)\n💨 **Wind Vector:** ${current.windspeed} km/h\n${hazardBanners}`;
      systemPromptWeather = `currently showing ${cond.text} around ${current.temperature}°C`;
    }

    // Print final minimalist dashboard block to the frame layout
    oc.thread.messages.push({
      author: "system",
      content: makeSleekCard("Atmosphere Report", outputContent)
    });

    // Notify character configuration vectors seamlessly
    oc.character.customData.weatherContext = `[Context Note: Environment tracking flags for ${locationLabel} register as ${systemPromptWeather}. Make sure actions and text adjustments reflect these environments contextually.]`;

  } catch (err) {
    oc.thread.messages.push({ author: "system", content: "❌ Weather system metrics frame failed to compute." });
  }
});
