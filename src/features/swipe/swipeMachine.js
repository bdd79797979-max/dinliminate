const machines = new WeakMap();

export const SWIPE_CONFIG = Object.freeze({
  thresholdRatio: 0.21,
  thresholdMinPx: 72,
  thresholdMaxPx: 108,
  flickMinDistancePx: 48,
  flickVelocityPxPerMs: 0.5,
  maxVelocityPxPerMs: 2.4,
  exitRotationDeg: 11,
  exitPaddingPx: 48,
  exitDurationMinMs: 240,
  exitDurationMaxMs: 300,
  exitDurationBaseMs: 300,
  exitDurationVelocityScale: 30,
  settleDurationMs: 220
});

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const cardWidth = card => Math.max(280,Number(card?.clientWidth)||430);
const thresholdFor = card => clamp(
  Math.round(cardWidth(card)*SWIPE_CONFIG.thresholdRatio),
  SWIPE_CONFIG.thresholdMinPx,
  SWIPE_CONFIG.thresholdMaxPx
);

export function triggerSwipeHaptic(){
  try{
    const nativeHandler=window?.webkit?.messageHandlers?.haptic;
    if(nativeHandler?.postMessage){nativeHandler.postMessage('light');return true;}
  }catch(error){console.error('Dinliminate swipe haptic error',error)}
  try{
    if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')return !!navigator.vibrate(8);
  }catch(error){console.error('Dinliminate swipe haptic error',error)}
  return false;
}

function makeMachine(card,{onCut=()=>{},onMaybe=()=>{},onPreview=()=>{},onHaptic=triggerSwipeHaptic,getContext=()=>({}),kind=''}){
  let phase='idle';
  let pointerId=null;
  let transactionId=0;
  let activeTransaction=0;
  let downX=0;
  let downY=0;
  let lastX=0;
  let lastMoveX=0;
  let lastMoveTime=0;
  let velocityX=0;
  let moveFrame=0;
  let animation=null;
  let hapticTriggered=false;
  let suppressClickUntil=0;
  let destroyed=false;

  const current=()=>!destroyed&&machines.get(card)===api;
  const setPhase=next=>{
    phase=next;
    card.dataset.swipePhase=next;
    card.dataset.swipeTransaction=next==='committing'?'active':'';
  };
  const cancelMoveFrame=()=>{
    if(moveFrame){cancelAnimationFrame(moveFrame);moveFrame=0;}
  };
  const cancelAnimation=()=>{
    if(!animation)return;
    try{animation.cancel();}catch(error){console.error('Dinliminate swipe animation error',error)}
    animation=null;
  };
  const releasePointer=()=>{
    try{
      if(pointerId!=null&&card.hasPointerCapture?.(pointerId))card.releasePointerCapture(pointerId);
    }catch(error){console.error('Dinliminate swipe pointer release error',error)}
    pointerId=null;
  };
  const resetVisuals=()=>{
    cancelMoveFrame();
    const mediaPending=card.dataset.mediaPending==='true';
    const preserveSurface=mediaPending&&card.dataset.preserveMediaSurface==='true';
    const hideForMedia=mediaPending&&!preserveSurface;
    card.classList.remove('swipe-active','swipe-filling');
    card.style.willChange='';
    card.style.transition='none';
    card.style.transform='';
    // Some decision restores intentionally keep the card surface visible
    // (its title/details are already current) while the matching image loads.
    // Machine teardown must preserve that choice instead of hiding the whole card.
    card.style.opacity=hideForMedia?'0':'1';
    card.style.visibility=hideForMedia?'hidden':'visible';
    card.style.pointerEvents=hideForMedia?'none':'auto';
    card.style.removeProperty('--swipe-tint-alpha');
    card.dataset.swipe='';
    card.dataset.swipeDirection='';
    card.dataset.swipeFinalTransform='';
    card.dataset.swipeTransaction='';
    card.dataset.swipePhase='idle';
    phase='idle';
  };
  const dragVisual=(dx)=>{
    const width=cardWidth(card);
    const distance=Math.abs(dx);
    const rotation=(dx<0?-1:1)*clamp((distance/width)*SWIPE_CONFIG.exitRotationDeg,0,SWIPE_CONFIG.exitRotationDeg);
    card.style.transform='translate3d('+dx.toFixed(1)+'px,0,0) rotate('+rotation.toFixed(2)+'deg)';
    card.style.opacity='1';
    card.style.setProperty('--swipe-tint-alpha',String(clamp(distance/(thresholdFor(card)*1.15),0,.94)));
    card.dataset.swipe=dx<0?'cut':dx>0?'maybe':'';
    return {rotation};
  };
  const preserveExitFrame=()=>{
    const finalTransform=String(card.dataset.swipeFinalTransform||'').trim();
    if(finalTransform)card.style.transform=finalTransform;
    card.style.opacity='0';
    card.style.visibility='hidden';
    card.style.pointerEvents='none';
    card.style.willChange='transform,opacity';
  };

  const animate=(keyframes,timing)=>{
    if(typeof card.animate!=='function'){
      const error=new Error('Web Animations API unavailable');
      console.error('Dinliminate swipe animation error',error);
      return null;
    }
    return card.animate(keyframes,{fill:'forwards',...timing});
  };

  const settle=()=>{
    if(!current())return 'busy';
    if(phase!=='dragging')return phase==='committing'||phase==='settled'?'busy':'ignored';
    cancelMoveFrame();
    releasePointer();
    setPhase('settled');
    card.style.pointerEvents='auto';
    card.style.visibility='visible';
    card.style.opacity='1';
    card.style.willChange='transform';
    cancelAnimation();
    const localTransaction=++transactionId;
    activeTransaction=localTransaction;
    const snap=animate(
      [{transform:card.style.transform||'translate3d(0,0,0) rotate(0deg)'},{transform:'translate3d(0,0,0) rotate(0deg)'}],
      {duration:SWIPE_CONFIG.settleDurationMs,easing:'cubic-bezier(.22,1,.36,1)'}
    );
    animation=snap;
    const finish=()=>{
      if(!current()||activeTransaction!==localTransaction||phase!=='settled')return;
      animation=null;
      resetVisuals();
    };
    if(!snap){finish();return 'accepted';}
    snap.finished.then(finish).catch(error=>{
      if(current()&&activeTransaction===localTransaction){
        console.error('Dinliminate swipe settle error',error);
        finish();
      }
    });
    return 'accepted';
  };

  const commit=(direction,meta={})=>{
    const normalized=Number(direction)<0?-1:1;
    if(!current())return 'busy';
    if(phase==='committing'||phase==='settled')return 'busy';
    if(phase!=='idle'&&phase!=='dragging')return 'busy';

    cancelMoveFrame();
    const wasDragging=phase==='dragging';
    const dragDx=lastX-downX;
    const threshold=thresholdFor(card);
    const distance=Math.max(threshold,Math.abs(dragDx));
    const fromDx=wasDragging?dragDx:0;
    const dx=normalized*distance;
    const source=String(meta.source||'gesture');

    releasePointer();
    // Finish the color wash while the existing off-screen card flight continues.
    card.classList.add('swipe-filling');
    void card.offsetWidth;
    card.style.setProperty('--swipe-tint-alpha','1');
    phase='committing';
    const localTransaction=++transactionId;
    activeTransaction=localTransaction;
    card.dataset.swipePhase='committing';
    card.dataset.swipeTransaction='active';
    card.dataset.swipeDirection=normalized<0?'cut':'maybe';
    card.style.pointerEvents='none';
    card.style.visibility='visible';
    card.style.opacity='1';
    card.style.willChange='transform,opacity';
    card.style.transition='none';

    const context={
      ...getContext(),
      kind,
      direction:normalized<0?'cut':'maybe',
      directionValue:normalized,
      distance:Math.abs(dx),
      velocity:velocityX,
      source,
      transactionId:localTransaction
    };
    onPreview?.(context);
    if((source==='button'||wasDragging)&&!hapticTriggered){
      hapticTriggered=true;
      onHaptic?.();
    }

    const width=cardWidth(card);
    const from=dragVisual(fromDx);
    const fromTransform=fromDx===0
      ?'translate3d(0,0,0) rotate(0deg)'
      :card.style.transform;
    const rect=card.getBoundingClientRect();
    const remaining=normalized<0
      ?rect.right+SWIPE_CONFIG.exitPaddingPx
      :window.innerWidth-rect.left+SWIPE_CONFIG.exitPaddingPx;
    const targetX=(fromDx||0)+(normalized<0?-remaining:remaining);
    const targetRotation=normalized*SWIPE_CONFIG.exitRotationDeg;
    const targetTransform='translate3d('+targetX.toFixed(1)+'px,0,0) rotate('+targetRotation.toFixed(2)+'deg)';
    const speed=clamp(Math.abs(velocityX),0,SWIPE_CONFIG.maxVelocityPxPerMs);
    const duration=Math.round(clamp(
      SWIPE_CONFIG.exitDurationBaseMs-(speed*SWIPE_CONFIG.exitDurationVelocityScale),
      SWIPE_CONFIG.exitDurationMinMs,
      SWIPE_CONFIG.exitDurationMaxMs
    ));
    card.dataset.swipeFinalTransform=targetTransform;
    const exit=animate(
      [
        {transform:fromTransform,opacity:1},
        {transform:targetTransform,opacity:0}
      ],
      {duration,easing:'cubic-bezier(.20,.84,.24,1)'}
    );
    animation=exit;
    if(!exit){
      if(current()&&activeTransaction===localTransaction){
        preserveExitFrame();
        setPhase('settled');
        Promise.resolve(normalized<0?onCut?.({fromSwipe:true,...context}):onMaybe?.({fromSwipe:true,...context}))
          .catch(error=>console.error('Dinliminate swipe commit error',error))
          .finally(()=>{
            if(current()&&activeTransaction===localTransaction)resetVisuals();
          });
      }
      return 'accepted';
    }
    exit.finished.then(async()=>{
      if(!current()||activeTransaction!==localTransaction||phase!=='committing')return;
      // Keep the finished WAAPI animation referenced until the action callback
      // redraws this shared card. drawFood()/drawRestaurant() destroys this
      // machine; destroy() must still be able to cancel the fill-forwards effect.
      // Otherwise the old off-screen transform survives the CSS reset and the
      // next card looks visible but its hit area remains off-screen.
      preserveExitFrame();
      setPhase('settled');
      try{
        if(normalized<0)await onCut?.({fromSwipe:true,...context});
        else await onMaybe?.({fromSwipe:true,...context});
      }catch(error){
        console.error('Dinliminate swipe commit error',error);
      }
      if(!current()||activeTransaction!==localTransaction||phase!=='settled')return;
      // If the action switched screens without rebinding this machine, clear
      // the finished animation's fill effect before restoring the card styles.
      cancelAnimation();
      resetVisuals();
    }).catch(error=>{
      if(!current()||activeTransaction!==localTransaction)return;
      console.error('Dinliminate swipe exit error',error);
      preserveExitFrame();
      cancelAnimation();
      setPhase('settled');
      Promise.resolve(normalized<0?onCut?.({fromSwipe:true,...context}):onMaybe?.({fromSwipe:true,...context}))
        .catch(commitError=>console.error('Dinliminate swipe commit error',commitError))
        .finally(()=>{
          if(current()&&activeTransaction===localTransaction)resetVisuals();
        });
    });
    suppressClickUntil=performance.now()+700;
    card.style.transform=fromTransform;
    return 'accepted';
  };

  const finishGesture=()=>{
    if(phase!=='dragging')return;
    cancelMoveFrame();
    const dx=lastX-downX;
    const distance=Math.abs(dx);
    const threshold=thresholdFor(card);
    const velocity=Math.abs(velocityX);
    if(distance>=threshold||(distance>=SWIPE_CONFIG.flickMinDistancePx&&velocity>=SWIPE_CONFIG.flickVelocityPxPerMs)){
      commit(dx<0?-1:1,{source:'gesture'});
      return;
    }
    velocityX=0;
    settle();
  };

  const onPointerDown=event=>{
    // A new Meal shell can be visible while its correct photo loads. Keep its
    // details button usable, but don't start a gesture until the photo is ready.
    if(card.dataset.mediaPending==='true')return;
    if(destroyed||event.isPrimary===false||phase!=='idle')return;
    if(event.button!=null&&event.button!==0)return;
    if(event.target?.closest?.('button,a,input,select,textarea'))return;
    downX=event.clientX;downY=event.clientY;lastX=event.clientX;lastMoveX=event.clientX;
    lastMoveTime=performance.now();velocityX=0;hapticTriggered=false;
    card.classList.remove('swipe-filling');
    card.classList.add('swipe-active');
    card.style.touchAction='none';
    card.style.userSelect='none';
    card.style.webkitUserSelect='none';
    card.style.webkitTouchCallout='none';
    card.style.pointerEvents='auto';
    card.style.willChange='transform';
    card.style.transition='none';
    card.style.opacity='1';
    card.style.visibility='visible';
    card.dataset.swipe='';
    card.dataset.swipeDirection='';
    setPhase('dragging');
    try{card.setPointerCapture?.(event.pointerId);}catch(error){console.error('Dinliminate swipe pointer capture error',error)}
    pointerId=event.pointerId;
    suppressClickUntil=performance.now()+350;
  };
  const paintMove=()=>{
    moveFrame=0;
    if(!current()||phase!=='dragging')return;
    const dx=lastX-downX;
    if(Math.abs(dx)<=2)return;
    dragVisual(dx);
    if(Math.abs(dx)>=thresholdFor(card)&&!hapticTriggered){
      hapticTriggered=true;
      onHaptic?.();
    }
  };
  const onPointerMove=event=>{
    if(!current()||phase!=='dragging'||event.pointerId!==pointerId||event.isPrimary===false)return;
    const now=performance.now();
    const dt=Math.max(1,now-lastMoveTime);
    velocityX=(event.clientX-lastMoveX)/dt;
    lastMoveX=event.clientX;lastMoveTime=now;lastX=event.clientX;
    if(Math.abs(lastX-downX)>2){
      if(event.cancelable)event.preventDefault();
      if(!moveFrame)moveFrame=requestAnimationFrame(paintMove);
    }
  };
  const onPointerUp=event=>{
    if(phase!=='dragging'||event.pointerId!==pointerId)return;
    lastX=event.clientX;
    finishGesture();
  };
  const onPointerCancel=()=>{
    if(phase!=='dragging')return;
    velocityX=0;
    settle();
  };
  const onLostPointerCapture=()=>{
    if(phase==='dragging'){
      velocityX=0;
      settle();
    }
  };
  const onClick=event=>{
    if(performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}
  };

  card.addEventListener('pointerdown',onPointerDown,{passive:true});
  card.addEventListener('pointermove',onPointerMove,{passive:false});
  card.addEventListener('pointerup',onPointerUp,{passive:true});
  card.addEventListener('pointercancel',onPointerCancel,{passive:true});
  card.addEventListener('lostpointercapture',onLostPointerCapture,{passive:true});
  card.addEventListener('click',onClick,{passive:false});

  const api={
    get phase(){return phase;},
    get transactionId(){return activeTransaction;},
    commit,
    settle,
    isBusy:()=>phase==='committing'||phase==='settled',
    destroy(){
      if(destroyed)return;
      destroyed=true;
      activeTransaction=++transactionId;
      cancelMoveFrame();
      cancelAnimation();
      releasePointer();
      card.removeEventListener('pointerdown',onPointerDown);
      card.removeEventListener('pointermove',onPointerMove);
      card.removeEventListener('pointerup',onPointerUp);
      card.removeEventListener('pointercancel',onPointerCancel);
      card.removeEventListener('lostpointercapture',onLostPointerCapture);
      card.removeEventListener('click',onClick);
      // A Meal redraw reuses #foodCard. Clean the outgoing gesture before
      // binding its next transaction, while respecting a pending photo handoff.
      resetVisuals();
      if(machines.get(card)===api)machines.delete(card);
    }
  };
  setPhase('idle');
  card.style.touchAction='none';
  card.style.userSelect='none';
  card.style.webkitUserSelect='none';
  card.style.webkitTouchCallout='none';
  card.style.pointerEvents=card.dataset.mediaPending==='true'&&card.dataset.preserveMediaSurface!=='true'?'none':'auto';
  return api;
}

export function bindSwipeCard(cardOrId,onCut,onMaybe,options={}){
  const card=typeof cardOrId==='string'?document.getElementById(cardOrId):cardOrId;
  if(!card)return null;
  machines.get(card)?.destroy();
  const api=makeMachine(card,{...options,onCut,onMaybe});
  machines.set(card,api);
  return api;
}

export function getSwipeMachine(cardOrId){
  const card=typeof cardOrId==='string'?document.getElementById(cardOrId):cardOrId;
  return card?machines.get(card)||null:null;
}
