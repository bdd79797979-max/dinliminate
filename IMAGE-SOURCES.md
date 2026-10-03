# Dinliminate image-source governance

## Current release
Build 707 · cp707-audit-fixes-except-hidden-restaurant-controls

## Policy
Built-in food imagery must use HTTPS. Quick Cut imagery is sourced from approved image CDNs used by the release. The app also inventories every third-party food-image host so usage can be reviewed before public launch.

## Hosts in Build 125
- images.pexels.com — approved application image CDN
- images.unsplash.com — approved application image CDN
- static.spotapps.co — third-party source; rights/usage review required
- hips.hearstapps.com — third-party source; rights/usage review required
- calliesbiscuits.com — third-party source; rights/usage review required
- vinovoss.com — third-party source; rights/usage review required
- recipesclare.com — third-party source; rights/usage review required
- commons.wikimedia.org — source-specific license review required per asset
- www.ajsbbq.co.nz — third-party source; rights/usage review required
- southernbite.com — third-party source; rights/usage review required
- snapcalorie-webflow-website.s3.us-east-2.amazonaws.com — third-party source; rights/usage review required
- butterhearth.com — third-party source; rights/usage review required
- www.pastapiracy.com — third-party source; rights/usage review required
- slicelife.imgix.net — third-party source; rights/usage review required
- cdn.shopify.com — source host; the underlying asset owner/license must be identified
- savouryflavor.com — third-party source; rights/usage review required
- resizer.otstatic.com — third-party source; rights/usage review required
- www.cooksoups.com — third-party source; rights/usage review required
- bigbitesedenderry.com — third-party source; rights/usage review required
- kookycrunch.com — third-party source; rights/usage review required
- www.goodnes.com — official Stouffer source image; usage/redistribution review required
- cdn11.bigcommerce.com — third-party source; rights/usage review required

## Launch status
The automated inventory is complete. The legal/usage verification of the non-approved third-party assets is not something the runtime can establish automatically; those assets should be replaced with approved local/CDN assets or individually cleared before public distribution.


## CP250 photo refresh
- Tacos: Pexels photo 14179985.
- Mexican Stir Fry: Pexels photo 31673757.
- Vegetable Lasagna: Pexels photo 5864352.
- Beef Stroganoff: Pexels photo 28503619.
- Health Shake: Pexels photo 7974814.
- Buttermilk & Cornbread: Pexels photo 36863862.
- Meatloaf & Mashed Potatoes, Potato Soup, Stuffed Peppers, and Salisbury Steak retain dish-specific sources already verified in the catalog because the available free-use search results did not provide more exact replacements.


## CP257 photo refresh
- Beef Stroganoff: Pexels photo 20234576.
- Stuffed Peppers: official Stouffer/Goodnes product image.
- Pizza: Pexels photo 7813574.
- Meatball Sub: Wikimedia Commons Meatball Sub image.
- Sausage & Peppers: Pexels photo 38085038.
- Buttermilk & Cornbread: Pexels photo 6525832.
- Grilled Salmon: Pexels photo 14542171.
- BBQ Pulled Pork: Pexels photo 7181419.
- Mashed Potatoes: Pexels photo 30635680.
- Pork Tenderloin: Pexels photo 341044.
- White Fish: Pexels photo 36378584.
- The Stouffer/Goodnes asset is an official product image and still requires usage/redistribution review before public distribution.


## CP258 new food images
CP258 additions use HTTPS food image URLs stored with each item in `data/foods.js` and covered by the image smoke audit. Most additions use Pexels; Gumbo uses the existing SnapCalorie image host already tracked below.

Added-image IDs: pot-pie, blt, reuben, hot-dog, corn-dog, nachos, orange-chicken, chicken-teriyaki, sushi, pancakes, omelet, oatmeal, shrimp, crab-cakes, gumbo, chicken-nuggets, ramen, pimento-cheese-sandwich, ice-cream, protein-bar, candy-bar, banana, apple.


## CP258 image corrections after CI
- Pork Tenderloin: Pexels photo 792027 after the original 341044 CDN URL returned HTTP 404 in CI. Pexels identifies 792027 as a pork tenderloin dish. citeturn618106search7
- Sushi: Pexels photo 6249504; Pexels identifies it as assorted sushi rolls. citeturn618106search17
- Gumbo: SnapCalorie `gumbo_with_rice.jpg`, retained under the already-listed `snapcalorie-webflow-website.s3.us-east-2.amazonaws.com` host; usage review remains required before public distribution.
- Cereal: Pexels photo 4324304, replacing a Wikimedia Commons URL that returned HTTP 429 during automated image validation. Pexels describes 4324304 as a cereal breakfast image. 
