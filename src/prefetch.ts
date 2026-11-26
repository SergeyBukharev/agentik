const loaders={profile:()=>import('./components/Profile'),rooms:()=>import('./components/Rooms')};
export function prefetchScreen(screen:keyof typeof loaders){void loaders[screen]().catch(()=>{});}
export function schedulePrefetch(){const run=()=>{prefetchScreen('profile');prefetchScreen('rooms');};if('requestIdleCallback'in window){const handle=window.requestIdleCallback(run,{timeout:2500});return()=>window.cancelIdleCallback(handle);}const timer=setTimeout(run,1500);return()=>clearTimeout(timer);}
