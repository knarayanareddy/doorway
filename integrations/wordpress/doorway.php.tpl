<?php
/**
 * Plugin Name: Doorway
 * Description: Shows a help-routing card when your platform's own moderation flags a search. Stores nothing about visitors.
 * Version: {{VERSION}}
 * License: MIT
 *
 * Install: upload, activate, then Settings > Doorway: paste your install id. That is all.
 * Doorway is the response layer only. It does not detect anything: your platform (or a
 * moderation plugin) fires the `doorway:flag` event, or calls window.doorway.trigger('search').
 * Never pass the visitor's query.
 */
if (!defined('ABSPATH')) { exit; }

const DOORWAY_SRC = '{{SRC}}';
const DOORWAY_SRI = '{{SRI}}';

add_action('admin_menu', function () {
    add_options_page('Doorway', 'Doorway', 'manage_options', 'doorway', function () {
        if (!current_user_can('manage_options')) { return; }
        echo '<div class="wrap"><h1>Doorway</h1><form method="post" action="options.php">';
        settings_fields('doorway');
        do_settings_sections('doorway');
        submit_button();
        echo '</form></div>';
    });
});

add_action('admin_init', function () {
    register_setting('doorway', 'doorway_install', [
        'type' => 'string',
        'sanitize_callback' => function ($v) { $v = trim((string) $v); return preg_match('/^inst_[a-z0-9]{6,}$/', $v) ? $v : ''; },
        'default' => '',
    ]);
    register_setting('doorway', 'doorway_country', ['type' => 'string', 'sanitize_callback' => function ($v) { $v = strtoupper(trim((string) $v)); return preg_match('/^[A-Z]{2}$/', $v) ? $v : ''; }, 'default' => '']);
    register_setting('doorway', 'doorway_legal_jurisdiction', ['type' => 'string', 'sanitize_callback' => function ($v) { $v = strtoupper(trim((string) $v)); return preg_match('/^[A-Z]{2}$/', $v) ? $v : ''; }, 'default' => '']);
    add_settings_section('doorway_main', '', '__return_false', 'doorway');
    foreach ([
        'doorway_install' => ['Install id', 'inst_xxxxxx — from your Doorway welcome message'],
        'doorway_country' => ['Country (optional)', 'Two letters, e.g. NL. Chooses which help service is offered.'],
        'doorway_legal_jurisdiction' => ['Legal jurisdiction (optional)', 'Only set this if a reviewed legal record exists for it. Leave empty otherwise.'],
    ] as $key => $meta) {
        add_settings_field($key, $meta[0], function () use ($key, $meta) {
            printf('<input name="%1$s" value="%2$s" class="regular-text"><p class="description">%3$s</p>', esc_attr($key), esc_attr(get_option($key, '')), esc_html($meta[1]));
        }, 'doorway', 'doorway_main');
    }
});

add_action('wp_enqueue_scripts', function () {
    if (!get_option('doorway_install')) { return; }
    wp_enqueue_script('doorway', DOORWAY_SRC, [], null, ['strategy' => 'defer', 'in_footer' => true]);
});

add_filter('script_loader_tag', function ($tag, $handle) {
    if ($handle !== 'doorway') { return $tag; }
    $attrs = sprintf(
        ' integrity="%s" crossorigin="anonymous" data-install="%s" data-trigger-event="doorway:flag"',
        esc_attr(DOORWAY_SRI), esc_attr(get_option('doorway_install'))
    );
    if (get_option('doorway_country')) { $attrs .= ' data-country="' . esc_attr(get_option('doorway_country')) . '"'; }
    if (get_option('doorway_legal_jurisdiction')) { $attrs .= ' data-legal-jurisdiction="' . esc_attr(get_option('doorway_legal_jurisdiction')) . '"'; }
    return str_replace(' src=', $attrs . ' src=', $tag);
}, 10, 2);
