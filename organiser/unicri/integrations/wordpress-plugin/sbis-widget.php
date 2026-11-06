<?php
/**
 * Plugin Name: Stop Before It Starts Widget
 * Description: Embeds the SBIS prevention widget on your WordPress site.
 * Version:     0.1.0
 * License:     MIT
 * License URI: https://opensource.org/licenses/MIT
 *
 * Starter skeleton — not production ready.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* -----------------------------------------------------------------------
 * Enqueue the widget script on the front end
 * --------------------------------------------------------------------- */
add_action( 'wp_enqueue_scripts', function () {
    $url = get_option( 'sbis_widget_url', '' );
    if ( empty( $url ) ) {
        return; // No URL configured — nothing to load.
    }
    wp_enqueue_script(
        'sbis-widget',
        esc_url( $url ),
        array(),
        '0.1.0',
        array( 'in_footer' => true, 'strategy' => 'defer' )
    );
    // The widget uses ES modules (import.meta.url), so add type="module".
    wp_script_add_data( 'sbis-widget', 'type', 'module' );
} );

/* -----------------------------------------------------------------------
 * Shortcode: [sbis_widget]
 * Outputs a container div the widget script attaches to.
 * --------------------------------------------------------------------- */
add_shortcode( 'sbis_widget', function () {
    $country = esc_attr( get_option( 'sbis_country', 'NL' ) );
    return '<div id="sbis-widget" data-country="' . $country . '"></div>';
} );

/* -----------------------------------------------------------------------
 * Settings page (Settings > SBIS Widget)
 * --------------------------------------------------------------------- */
add_action( 'admin_menu', function () {
    add_options_page(
        'SBIS Widget Settings',
        'SBIS Widget',
        'manage_options',
        'sbis-widget',
        'sbis_render_settings_page'
    );
} );

add_action( 'admin_init', function () {
    register_setting( 'sbis_settings', 'sbis_widget_url' );
    register_setting( 'sbis_settings', 'sbis_country' );
} );

function sbis_render_settings_page() {
    ?>
    <div class="wrap">
        <h1>SBIS Widget Settings</h1>
        <p><em>Starter skeleton &mdash; not production ready.</em></p>
        <form method="post" action="options.php">
            <?php settings_fields( 'sbis_settings' ); ?>
            <table class="form-table">
                <tr>
                    <th scope="row"><label for="sbis_widget_url">Widget JS URL</label></th>
                    <td><input type="url" id="sbis_widget_url" name="sbis_widget_url"
                               value="<?php echo esc_attr( get_option( 'sbis_widget_url' ) ); ?>"
                               class="regular-text" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sbis_country">Country (ISO 3166-1)</label></th>
                    <td><input type="text" id="sbis_country" name="sbis_country"
                               value="<?php echo esc_attr( get_option( 'sbis_country', 'NL' ) ); ?>"
                               class="small-text" maxlength="2" /></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
