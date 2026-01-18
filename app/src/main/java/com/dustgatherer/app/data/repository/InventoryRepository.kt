package com.dustgatherer.app.data.repository

import com.dustgatherer.app.data.local.InventoryDao
import com.dustgatherer.app.data.model.InventoryItem
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

class InventoryRepository(private val inventoryDao: InventoryDao) {

    fun getAllItems(): Flow<List<InventoryItem>> = inventoryDao.getAllItems()

    suspend fun getItemById(id: Long): InventoryItem? = inventoryDao.getItemById(id)

    fun getItemByIdFlow(id: Long): Flow<InventoryItem?> = inventoryDao.getItemByIdFlow(id)

    suspend fun insertItem(item: InventoryItem): Long = inventoryDao.insertItem(item)

    suspend fun updateItem(item: InventoryItem) = inventoryDao.updateItem(
        item.copy(updatedAt = System.currentTimeMillis())
    )

    suspend fun deleteItem(item: InventoryItem) = inventoryDao.deleteItem(item)

    suspend fun deleteItemById(id: Long) = inventoryDao.deleteItemById(id)

    fun getItemsScheduledFor(date: LocalDate): Flow<List<InventoryItem>> =
        inventoryDao.getItemsScheduledFor(date)

    fun getItemsScheduledBetween(startDate: LocalDate, endDate: LocalDate): Flow<List<InventoryItem>> =
        inventoryDao.getItemsScheduledBetween(startDate, endDate)

    fun getUnscheduledItems(): Flow<List<InventoryItem>> = inventoryDao.getUnscheduledItems()

    fun getPostedItems(): Flow<List<InventoryItem>> = inventoryDao.getPostedItems()

    fun getSoldItems(): Flow<List<InventoryItem>> = inventoryDao.getSoldItems()

    fun getTotalSpent(): Flow<Double?> = inventoryDao.getTotalSpent()

    fun getTotalRevenue(): Flow<Double?> = inventoryDao.getTotalRevenue()

    fun getTotalItemCount(): Flow<Int> = inventoryDao.getTotalItemCount()

    fun getSoldItemCount(): Flow<Int> = inventoryDao.getSoldItemCount()

    fun getActiveListingsCount(): Flow<Int> = inventoryDao.getActiveListingsCount()

    fun searchItems(query: String): Flow<List<InventoryItem>> = inventoryDao.searchItems(query)

    // Bulk operations for import/export
    suspend fun getAllItemsSnapshot(): List<InventoryItem> = inventoryDao.getAllItemsSnapshot()

    suspend fun insertItems(items: List<InventoryItem>): List<Long> = inventoryDao.insertItems(items)
}
