package com.dustgatherer.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.dustgatherer.app.data.local.ThemeMode

private val LightColorScheme = lightColorScheme(
    primary = Burgundy,
    onPrimary = Color.White,
    primaryContainer = BurgundyLight,
    onPrimaryContainer = Color.White,
    secondary = Taupe,
    onSecondary = Color.White,
    secondaryContainer = TaupeLight,
    onSecondaryContainer = Charcoal,
    tertiary = Sage,
    onTertiary = Color.White,
    background = Cream,
    onBackground = Charcoal,
    surface = Color.White,
    onSurface = Charcoal,
    surfaceVariant = LightGray,
    onSurfaceVariant = Charcoal,
    outline = Taupe
)

private val DarkColorScheme = darkColorScheme(
    primary = BurgundyLight,
    onPrimary = Color.White,
    primaryContainer = Burgundy,
    onPrimaryContainer = Color.White,
    secondary = TaupeLight,
    onSecondary = Charcoal,
    secondaryContainer = Taupe,
    onSecondaryContainer = Color.White,
    tertiary = Sage,
    onTertiary = Charcoal,
    background = Charcoal,
    onBackground = Cream,
    surface = Color(0xFF3D3D3D),
    onSurface = Cream,
    surfaceVariant = Color(0xFF4D4D4D),
    onSurfaceVariant = Cream,
    outline = TaupeLight
)

@Composable
fun DustGathererTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val systemDarkTheme = isSystemInDarkTheme()
    val darkTheme = when (themeMode) {
        ThemeMode.SYSTEM -> systemDarkTheme
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }

    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
