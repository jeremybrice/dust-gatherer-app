package com.dustgatherer.app.ui.navigation

import android.net.Uri
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.dustgatherer.app.R
import com.dustgatherer.app.ui.screens.analytics.AnalyticsScreen
import com.dustgatherer.app.ui.screens.calendar.CalendarScreen
import com.dustgatherer.app.ui.screens.inventory.InventoryScreen
import com.dustgatherer.app.ui.screens.itemdetail.ItemDetailScreen
import com.dustgatherer.app.ui.screens.settings.SettingsScreen
import com.dustgatherer.app.viewmodel.CalendarViewModel
import com.dustgatherer.app.viewmodel.InventoryViewModel
import com.dustgatherer.app.viewmodel.ItemDetailViewModel
import com.dustgatherer.app.viewmodel.SettingsViewModel

sealed class Screen(val route: String, val title: String, val icon: ImageVector?) {
    data object Inventory : Screen("inventory", "Inventory", Icons.Default.Inventory2)
    data object Calendar : Screen("calendar", "Schedule", Icons.Default.CalendarMonth)
    data object Analytics : Screen("analytics", "Analytics", Icons.Default.Analytics)
    data object Settings : Screen("settings", "Settings", Icons.Default.Settings)
    data object ItemDetail : Screen("item/{itemId}", "Item", null) {
        fun createRoute(itemId: Long?) = "item/${itemId ?: 0}"
    }
}

val bottomNavItems = listOf(
    Screen.Inventory,
    Screen.Calendar,
    Screen.Analytics
)

@Composable
fun AppNavigation(
    inventoryViewModel: InventoryViewModel,
    calendarViewModel: CalendarViewModel,
    itemDetailViewModel: ItemDetailViewModel,
    settingsViewModel: SettingsViewModel,
    onImageSelected: (Uri) -> String?
) {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination

                bottomNavItems.forEach { screen ->
                    val label = when (screen) {
                        Screen.Inventory -> stringResource(R.string.inventory)
                        Screen.Calendar -> stringResource(R.string.schedule)
                        Screen.Analytics -> stringResource(R.string.analytics)
                        else -> screen.title
                    }
                    NavigationBarItem(
                        icon = { Icon(screen.icon!!, contentDescription = label) },
                        label = { Text(label) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Inventory.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Inventory.route) {
                InventoryScreen(
                    viewModel = inventoryViewModel,
                    onItemClick = { itemId ->
                        navController.navigate(Screen.ItemDetail.createRoute(itemId))
                    },
                    onAddClick = {
                        navController.navigate(Screen.ItemDetail.createRoute(null))
                    },
                    onSettingsClick = {
                        navController.navigate(Screen.Settings.route)
                    }
                )
            }

            composable(Screen.Calendar.route) {
                CalendarScreen(
                    viewModel = calendarViewModel,
                    onItemClick = { itemId ->
                        navController.navigate(Screen.ItemDetail.createRoute(itemId))
                    },
                    onSettingsClick = {
                        navController.navigate(Screen.Settings.route)
                    }
                )
            }

            composable(Screen.Analytics.route) {
                AnalyticsScreen(
                    viewModel = inventoryViewModel,
                    onSettingsClick = {
                        navController.navigate(Screen.Settings.route)
                    }
                )
            }

            composable(
                route = Screen.ItemDetail.route,
                arguments = listOf(
                    navArgument("itemId") { type = NavType.LongType }
                )
            ) { backStackEntry ->
                val itemId = backStackEntry.arguments?.getLong("itemId")
                ItemDetailScreen(
                    viewModel = itemDetailViewModel,
                    itemId = if (itemId == 0L) null else itemId,
                    onNavigateBack = { navController.popBackStack() },
                    onImageSelected = onImageSelected
                )
            }

            composable(Screen.Settings.route) {
                SettingsScreen(
                    viewModel = settingsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}
