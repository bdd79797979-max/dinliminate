const initialState = {
  screen:'home',hidden:new Set(),deleted:new Set(),hiddenRestaurants:{},cutCats:new Set(),foodCuts:new Set(),maybe:new Set(),maybeDeck:false,foodMaybeRound:false,custom:[],customQuickCuts:[],deletedCustomMeals:[],pool:[],index:0,foodActions:[],
  restaurantPool:[],restaurantIndex:0,restaurantCuts:new Set(),restaurantActions:[],restaurantMaybeRound:false,restaurantQuery:'',restaurantHours:'all',restaurantHoursCollapsed:true,location:null,locationSource:'none',restaurantSearchLatencyMs:0,restaurantSearchRadius:10,saved:false,storageWarning:false,restaurantSearchDegraded:false,locationFreshAt:null,winnerItem:null,winnerType:'food',
  hungryWheelChoice:null,hungryWheelSpinning:false,hungryWheelRotation:0,hungryWheelDisplayItems:null,hungryWheelLandedId:null,hungryWheelSpinPhase:'idle',hungryWheelVelocity:0,hungryWheelFrame:null,hungryWheelLastFrame:0,hungryWheelDragging:false,hungryWheelDragAngle:0,hungryWheelDragRotation:0,hungryWheelDragLastTime:0,hungryWheelDragVelocity:0,hungryRestaurantChoice:null,hungryRestaurantPendingChoice:null,hungryWheelSpinToken:0,
  schemaVersion:7,notes:{},tutorialState:{active:false,screen:'',index:0,steps:[],token:0,awaitingAction:false,pendingDecisionScreen:'',returnContext:null,firstDecisionScreen:''},
  foodHistory:[],restaurantHistory:[],foodRestoreExact:false,restaurantRestoreExact:false,restaurantSearchOrigin:null,restaurantSearchKey:'',quickCutsCollapsed:{food:true,restaurant:true},mealTimeCutsCollapsed:true,mealTimeFilters:new Set(['Breakfast','Lunch / Dinner','Snacks / Desserts']),mealTimeSettings:{custom:[],names:{},order:[],disabled:new Set()},
  familyNormalMode:'idle',familyDecisionType:'',familyNormalRoundId:'',familyNormalStage:0,familyNormalAutoResume:false,familyNormalVoteBusy:false,familyActiveData:null,familyVotedIds:new Set(),familyPollTimer:0,familyPollBusy:false,familyCompareBothMode:'',familyCompareBothGroupId:'',familyCompareBothMealWinner:null,familyBrowseHistory:[],tutorialMode:false
};
const listeners=new Set();
const stateProxy=new Proxy(initialState,{
 set(target,key,value){
  const old=target[key]; target[key]=value;
  listeners.forEach(listener=>{try{listener({key,value,old,state:stateProxy});}catch(error){console.error('Dinliminate store subscriber error',error);}});
  return true;
 },
 deleteProperty(target,key){
  const old=target[key]; delete target[key];
  listeners.forEach(listener=>{try{listener({key,value:undefined,old,state:stateProxy});}catch(error){console.error('Dinliminate store subscriber error',error);}});
  return true;
 }
});
export const store=Object.freeze({
 get(key){return key===undefined?stateProxy:stateProxy[key];},
 set(key,value){
  if(arguments.length===1&&key&&typeof key==='object'&&!Array.isArray(key)){
   Object.entries(key).forEach(([name,next])=>{stateProxy[name]=next;});
   return stateProxy;
  }
  stateProxy[key]=value;
  return value;
 },
 subscribe(listener){if(typeof listener!=='function')return()=>{};listeners.add(listener);return()=>listeners.delete(listener);}
});
export { initialState };
