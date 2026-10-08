export const $ = id => document.getElementById(id);

function readImageFile(file) {
return new Promise((resolve,reject) => {
if (!file) return resolve('');
if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
const reader = new FileReader();
reader.onerror = () => reject(new Error('Could not read that image.'));
reader.onload = () => {
const img = new Image();
img.onload = () => {
const max=1200, scale=Math.min(1,max/Math.max(img.width,img.height));
const canvas=document.createElement('canvas');
canvas.width=Math.max(1,Math.round(img.width*scale));
canvas.height=Math.max(1,Math.round(img.height*scale));
const ctx=canvas.getContext('2d');
ctx.drawImage(img,0,0,canvas.width,canvas.height);
resolve(canvas.toDataURL('image/jpeg',0.82));
};
img.onerror=()=>reject(new Error('Could not decode that image.'));
img.src=reader.result;
};
reader.readAsDataURL(file);
});
}
