package com.dustgatherer.app.data.local

import androidx.room.*
import com.dustgatherer.app.data.model.InventoryItem
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

@Dao
interface InventoryDao {
    @Query("SELECT * FROM inventory_items ORDER BY createdAt DESC")
    fun getAllItems(): Flow<List<InventoryItem>>

    @Query("SELECT * FROM inventory_items WHERE id = :id")
    suspend fun getItemById(id: Long): InventoryItem?

    @Query("SELECT * FROM inventory_items WHERE id = :id")
    fun getItemByIdFlow(id: Long): Flow<InventoryItem?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItem(item: InventoryItem): Long

    @Update
    suspend fun updateItem(item: InventoryItem)

    @Delete
    suspend fun deleteItem(item: InventoryItem)

    @Query("DELETE FROM inventory_items WHERE id = :id")
    suspend fun deleteItemById(id: Long)

    // Items scheduled for a specific date
    @Query("SELECT * FROM inventory_items WHERE scheduledPostDate = :date ORDER BY title")
    fun getItemsScheduledFor(date: LocalDate): Flow<List<InventoryItem>>

    // Items scheduled between dates (for calendar view)
    @Query("SELECT * FROM inventory_items WHERE scheduledPostDate BETWEEN :startDate AND :endDate ORDER BY scheduledPostDate")
    fun getItemsScheduledBetween(startDate: LocalDate, endDate: LocalDate): Flow<List<InventoryItem>>

    // Unscheduled items (in inventory)
    @Query("SELECT * FROM inventory_items WHERE scheduledPostDate IS NULL AND soldDate IS NULL ORDER BY purchaseDate DESC")
    fun getUnscheduledItems(): Flow<List<InventoryItem>>

    // Posted but not sold items
    @Query("SELECT * FROM inventory_items WHERE postedDate IS NOT NULL AND soldDate IS NULL ORDER BY postedDate DESC")
    fun getPostedItems(): Flow<List<InventoryItem>>

    // Sold items
    @Query("SELECT * FROM inventory_items WHERE soldDate IS NOT NULL ORDER BY soldDate DESC")
    fun getSoldItems(): Flow<List<InventoryItem>>

    // Analytics queries
    @Query("SELECT SUM(purchasePrice) FROM inventory_items")
    fun getTotalSpent(): Flow<Double?>

    @Query("SELECT SUM(sellingPrice) FROM inventory_items WHERE soldDate IS NOT NULL")
    fun getTotalRevenue(): Flow<Double?>

    @Query("SELECT COUNT(*) FROM inventory_items")
    fun getTotalItemCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM inventory_items WHERE soldDate IS NOT NULL")
    fun getSoldItemCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM inventory_items WHERE postedDate IS NOT NULL AND soldDate IS NULL")
    fun getActiveListingsCount(): Flow<Int>

    // Search
    @Query("SELECT * FROM inventory_items WHERE title LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%' ORDER BY createdAt DESC")
    fun searchItems(query: String): Flow<List<InventoryItem>>
}
