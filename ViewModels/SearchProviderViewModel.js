'use strict';

/*global require*/
var DeveloperError = require('../Cesium/Source/Core/DeveloperError');
var knockout = require('../Cesium/Source/ThirdParty/knockout');

var SearchProviderViewModel = function() {
    this.name = 'Unknown';
    this.isOpen = true;
    this.searchResults = [];
    this.searchMessage = undefined;
    this.isSearching = false;

    knockout.track(this, ['name', 'isOpen', 'searchResults', 'searchMessage', 'isSearching']);
};

SearchProviderViewModel.prototype.toggleOpen = function() {
    this.isOpen = !this.isOpen;
};

SearchProviderViewModel.prototype.search = function(searchText) {
    throw new DeveloperError('search must be implemented in the derived class.');
};

module.exports = SearchProviderViewModel;