/**
* Quick Filter
* Filters product grid items based on custom.filter_group metafield values.
* Uses a JSON map embedded in the page to avoid modifying existing templates.
*/


(function () {
 'use strict';


 const SELECTORS = {
   container: '.quick-filter',
   button: '.quick-filter__button',
   activeButton: '.quick-filter__button--active',
   jsonMap: '#quick-filter-map',
   productItem: '.product-grid__item',
 };


 const CLASSES = {
   active: 'quick-filter__button--active',
   hidden: 'quick-filter-hidden',
 };


 function init() {
   const container = document.querySelector(SELECTORS.container);
   if (!container) return;


   const mapElement = document.querySelector(SELECTORS.jsonMap);
   if (!mapElement) return;


   let productFilterMap;
   try {
     productFilterMap = JSON.parse(mapElement.textContent);
   } catch (e) {
     console.error('Quick Filter: Failed to parse product filter map', e);
     return;
   }


   const buttons = container.querySelectorAll(SELECTORS.button);
   if (!buttons.length) return;


   buttons.forEach((button) => {
     button.addEventListener('click', () => {
       handleFilterClick(button, buttons, productFilterMap);
     });
   });
 }


 function handleFilterClick(clickedButton, allButtons, productFilterMap) {
   // Update active state
   allButtons.forEach((btn) => btn.classList.remove(CLASSES.active));
   clickedButton.classList.add(CLASSES.active);


   const filterValue = clickedButton.dataset.filter;
   const productItems = document.querySelectorAll(SELECTORS.productItem);


   productItems.forEach((item) => {
     const productId = item.dataset.productId;
     const productFilterGroup = productFilterMap[productId];


     if (filterValue === 'all') {
       item.classList.remove(CLASSES.hidden);
     } else if (productFilterGroup === filterValue) {
       item.classList.remove(CLASSES.hidden);
     } else {
       item.classList.add(CLASSES.hidden);
     }
   });
 }


 // Initialize when DOM is ready
 if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', init);
 } else {
   init();
 }
})();


