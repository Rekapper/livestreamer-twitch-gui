import Ember from "Ember";
import preload from "utils/preload";


export default Ember.Route.extend({
	model: function() {
		return this.modelFor( "channel" );
	},

	afterModel: function( model ) {
		return Promise.resolve( model )
			.then( preload([
				"stream.preview.large_nocache"
			]) );
	},

	refresh: function() {
		return this.container.lookup( "route:channel" ).refresh();
	}
});
