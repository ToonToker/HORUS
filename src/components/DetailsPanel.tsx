import React from 'react';
import { useWorldViewStore } from '../store';
import { X, Info, Activity, MapPin, Link as LinkIcon, Camera } from 'lucide-react';

const DetailsPanel = () => {
  const { selectedEntity, setSelectedEntity } = useWorldViewStore();

  if (!selectedEntity) return null;

  return (
    <div className="w-80 h-full bg-black/80 border-l border-green-900/50 text-green-500 font-mono flex flex-col backdrop-blur-md">
      <div className="flex justify-between items-center p-4 border-b border-green-900/50">
        <div className="flex items-center gap-2 font-bold tracking-widest uppercase">
          <Info size={16} /> Entity Details
        </div>
        <button onClick={() => setSelectedEntity(null)} className="text-green-700 hover:text-green-400">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-widest text-green-400">{selectedEntity.callsign || selectedEntity.name || selectedEntity.title || selectedEntity.id}</h2>
          <div className="text-xs uppercase tracking-widest text-green-700 bg-green-900/20 px-2 py-1 rounded inline-block border border-green-900/50">
            {selectedEntity.type}
          </div>
        </div>

        {(selectedEntity.type === 'camera' || selectedEntity.type === 'cctvMesh') && (
          <div className="border border-green-900/50 rounded overflow-hidden relative group">
            <div className="absolute top-2 left-2 bg-black/50 text-[10px] px-1 rounded flex items-center gap-1 z-10">
              <div className={`w-2 h-2 rounded-full ${selectedEntity.status === 'online' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
              LIVE
            </div>
            <div className="aspect-video bg-green-900/20 flex items-center justify-center relative overflow-hidden">
              {selectedEntity.status === 'online' ? (
                <>
                  <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: 'url("https://picsum.photos/seed/cctv/400/225?grayscale")' }}></div>
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                  <Camera size={32} className="text-green-500/50" />
                </>
              ) : (
                <span className="text-green-800 text-xs">FEED OFFLINE</span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-green-700 mt-1" />
            <div className="space-y-1 w-full">
              <div className="text-xs uppercase tracking-widest text-green-700">Location</div>
              <div className="grid grid-cols-2 gap-2 text-sm bg-black p-2 rounded border border-green-900/30">
                <div>
                  <span className="text-green-800">LAT:</span> {selectedEntity.lat?.toFixed(4)}
                </div>
                <div>
                  <span className="text-green-800">LON:</span> {selectedEntity.lon?.toFixed(4)}
                </div>
                {selectedEntity.alt !== undefined && (
                  <div className="col-span-2">
                    <span className="text-green-800">ALT:</span> {selectedEntity.alt.toFixed(0)}m
                  </div>
                )}
                {selectedEntity.depth !== undefined && (
                  <div className="col-span-2">
                    <span className="text-green-800">DEPTH:</span> {selectedEntity.depth.toFixed(1)}km
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Activity size={16} className="text-green-700 mt-1" />
            <div className="space-y-1 w-full">
              <div className="text-xs uppercase tracking-widest text-green-700">Telemetry</div>
              <div className="grid grid-cols-2 gap-2 text-sm bg-black p-2 rounded border border-green-900/30">
                {/* Aviation & Marine */}
                {selectedEntity.speed !== undefined && (
                  <div><span className="text-green-800">SPD:</span> {selectedEntity.speed.toFixed(1)}kts</div>
                )}
                {selectedEntity.heading !== undefined && (
                  <div><span className="text-green-800">HDG:</span> {selectedEntity.heading.toFixed(1)}°</div>
                )}
                {selectedEntity.flightNum && (
                  <div className="col-span-2"><span className="text-green-800">FLT:</span> {selectedEntity.flightNum}</div>
                )}
                {selectedEntity.origin && selectedEntity.dest && (
                  <div className="col-span-2"><span className="text-green-800">ROUTE:</span> {selectedEntity.origin} &rarr; {selectedEntity.dest}</div>
                )}
                {selectedEntity.aircraftType && (
                  <div className="col-span-2"><span className="text-green-800">TYPE:</span> {selectedEntity.aircraftType}</div>
                )}
                {selectedEntity.squawk && (
                  <div><span className="text-green-800">SQUAWK:</span> {selectedEntity.squawk}</div>
                )}
                {selectedEntity.missionType && (
                  <div><span className="text-green-800">MSN:</span> {selectedEntity.missionType}</div>
                )}

                {/* Satellites */}
                {selectedEntity.noradId && (
                  <div><span className="text-green-800">NORAD:</span> {selectedEntity.noradId}</div>
                )}
                {selectedEntity.owner && (
                  <div><span className="text-green-800">OWNER:</span> {selectedEntity.owner}</div>
                )}
                {selectedEntity.apogee !== undefined && (
                  <div><span className="text-green-800">APO:</span> {selectedEntity.apogee.toFixed(0)}km</div>
                )}
                {selectedEntity.perigee !== undefined && (
                  <div><span className="text-green-800">PER:</span> {selectedEntity.perigee.toFixed(0)}km</div>
                )}
                {selectedEntity.resolvedIps && (
                  <div className="col-span-2"><span className="text-green-800">IP:</span> {selectedEntity.resolvedIps}</div>
                )}

                {/* Earth & Environment */}
                {selectedEntity.mag !== undefined && (
                  <div><span className="text-green-800">MAG:</span> {selectedEntity.mag.toFixed(1)}</div>
                )}
                {selectedEntity.fluxDensity !== undefined && (
                  <div className="col-span-2"><span className="text-green-800">FLUX:</span> {selectedEntity.fluxDensity.toFixed(0)} nT</div>
                )}
                {selectedEntity.kpIndex !== undefined && (
                  <div><span className="text-green-800">KP:</span> {selectedEntity.kpIndex}</div>
                )}
                {selectedEntity.solarWindSpeed !== undefined && (
                  <div className="col-span-2"><span className="text-green-800">SOLAR WIND:</span> {selectedEntity.solarWindSpeed.toFixed(0)} km/s</div>
                )}
                {selectedEntity.precipRate !== undefined && (
                  <div><span className="text-green-800">PRECIP:</span> {selectedEntity.precipRate.toFixed(1)} dBZ</div>
                )}
                {selectedEntity.windVelocity !== undefined && (
                  <div><span className="text-green-800">WIND:</span> {selectedEntity.windVelocity.toFixed(0)} kts</div>
                )}
                {selectedEntity.stormTopHeight !== undefined && (
                  <div className="col-span-2"><span className="text-green-800">STORM TOP:</span> {selectedEntity.stormTopHeight.toFixed(0)} ft</div>
                )}

                {/* Urban Grid */}
                {selectedEntity.flowSpeed !== undefined && (
                  <div><span className="text-green-800">FLOW:</span> {selectedEntity.flowSpeed.toFixed(0)} km/h</div>
                )}
                {selectedEntity.congestion !== undefined && (
                  <div><span className="text-green-800">CONG:</span> {selectedEntity.congestion.toFixed(0)}%</div>
                )}
                {selectedEntity.incidentReports !== undefined && (
                  <div className="col-span-2"><span className="text-green-800">INCIDENTS:</span> {selectedEntity.incidentReports}</div>
                )}
                {selectedEntity.bikesAvailable !== undefined && (
                  <div><span className="text-green-800">BIKES:</span> {selectedEntity.bikesAvailable}</div>
                )}
                {selectedEntity.ebikes !== undefined && (
                  <div><span className="text-green-800">E-BIKES:</span> {selectedEntity.ebikes}</div>
                )}
                {selectedEntity.powerLevel !== undefined && (
                  <div><span className="text-green-800">PWR:</span> {selectedEntity.powerLevel}%</div>
                )}
                {selectedEntity.category && (
                  <div className="col-span-2"><span className="text-green-800">CAT:</span> {selectedEntity.category}</div>
                )}
                {selectedEntity.hours && (
                  <div className="col-span-2"><span className="text-green-800">HOURS:</span> {selectedEntity.hours}</div>
                )}

                {/* Digital Mesh */}
                {selectedEntity.deviceType && (
                  <div className="col-span-2"><span className="text-green-800">DEVICE:</span> {selectedEntity.deviceType}</div>
                )}
                {selectedEntity.osVersion && (
                  <div className="col-span-2"><span className="text-green-800">OS:</span> {selectedEntity.osVersion}</div>
                )}
                {selectedEntity.openPorts && (
                  <div className="col-span-2"><span className="text-green-800">PORTS:</span> {selectedEntity.openPorts}</div>
                )}
                {selectedEntity.ssid && (
                  <div className="col-span-2"><span className="text-green-800">SSID:</span> {selectedEntity.ssid}</div>
                )}
                {selectedEntity.bssid && (
                  <div className="col-span-2"><span className="text-green-800">BSSID:</span> {selectedEntity.bssid}</div>
                )}
                {selectedEntity.encryption && (
                  <div><span className="text-green-800">ENC:</span> {selectedEntity.encryption}</div>
                )}
                {selectedEntity.signalStrength !== undefined && (
                  <div><span className="text-green-800">SIG:</span> {selectedEntity.signalStrength.toFixed(0)} dBm</div>
                )}
                {selectedEntity.cameraModel && (
                  <div className="col-span-2"><span className="text-green-800">MODEL:</span> {selectedEntity.cameraModel}</div>
                )}
                {selectedEntity.fov && (
                  <div><span className="text-green-800">FOV:</span> {selectedEntity.fov}</div>
                )}

                {/* Social & Gamified */}
                {selectedEntity.bitmojiDensity !== undefined && (
                  <div><span className="text-green-800">DENSITY:</span> {selectedEntity.bitmojiDensity}</div>
                )}
                {selectedEntity.heatIndex !== undefined && (
                  <div><span className="text-green-800">HEAT:</span> {selectedEntity.heatIndex.toFixed(0)}</div>
                )}
                {selectedEntity.poiType && (
                  <div className="col-span-2"><span className="text-green-800">TYPE:</span> {selectedEntity.poiType}</div>
                )}
                {selectedEntity.teamControl && (
                  <div className="col-span-2"><span className="text-green-800">TEAM:</span> {selectedEntity.teamControl}</div>
                )}
                {selectedEntity.raidTimer && (
                  <div className="col-span-2"><span className="text-green-800">RAID:</span> {selectedEntity.raidTimer}</div>
                )}

                {/* Generic */}
                {selectedEntity.intensity !== undefined && selectedEntity.type !== 'newsHeatmap' && selectedEntity.type !== 'snapchatMap' && (
                  <div><span className="text-green-800">INT:</span> {selectedEntity.intensity.toFixed(1)}</div>
                )}
                {selectedEntity.status !== undefined && selectedEntity.type !== 'camera' && selectedEntity.type !== 'cctvMesh' && (
                  <div className="col-span-2">
                    <span className="text-green-800">STATUS:</span> {selectedEntity.status.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-green-900/30">
          <div className="text-xs uppercase tracking-widest text-green-700 mb-2">Provenance</div>
          <a href="#" className="flex items-center gap-2 text-xs text-green-600 hover:text-green-400 hover:underline">
            <LinkIcon size={12} /> {
              selectedEntity.type === 'aircraft' ? 'OpenSky Network' : 
              selectedEntity.type === 'militaryFlight' ? 'ADS-B Exchange (MIL)' :
              selectedEntity.type === 'satellite' ? 'CelesTrak' : 
              selectedEntity.type === 'earthquake' ? 'USGS' : 
              selectedEntity.type === 'marineTraffic' ? 'AIS Marine Traffic' :
              selectedEntity.type === 'submarineCable' ? 'TeleGeography' :
              selectedEntity.type === 'wildfire' ? 'NASA FIRMS' :
              selectedEntity.type === 'newsHeatmap' ? 'GDELT Project' :
              selectedEntity.type === 'powerGrid' ? 'EIA Open Data' :
              selectedEntity.type === 'dataCenter' ? 'PeeringDB' :
              selectedEntity.type === 'cctvMesh' ? 'Insecam / Shodan' :
              selectedEntity.type === 'magnetosphere' ? 'NOAA SWPC' :
              selectedEntity.type === 'weatherRadar' ? 'RainViewer API' :
              selectedEntity.type === 'streetTraffic' ? 'Waze / Google Traffic' :
              selectedEntity.type === 'bikeshare' ? 'GBFS' :
              selectedEntity.type === 'poi' ? 'OpenStreetMap' :
              selectedEntity.type === 'internetDevice' ? 'Shodan' :
              selectedEntity.type === 'wigleWifi' ? 'WiGLE' :
              selectedEntity.type === 'snapchatMap' ? 'Snap Map API' :
              selectedEntity.type === 'pokemonGo' ? 'Niantic Wayfarer' :
              'DOT Public Feed'
            }
          </a>
          <div className="text-[10px] text-green-800 mt-2">
            Last seen: {new Date(selectedEntity.ts || Date.now()).toISOString()}
          </div>
        </div>

        <div className="pt-4 space-y-2">
          <button className="w-full py-2 bg-green-900/30 border border-green-500/50 hover:bg-green-900/50 text-sm uppercase tracking-wider rounded">
            Follow Entity
          </button>
          <button className="w-full py-2 bg-black border border-green-900/50 hover:bg-green-900/20 text-sm uppercase tracking-wider rounded">
            Add to Case
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailsPanel;
